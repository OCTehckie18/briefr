---
name: meeting-action-items
description: Turns a Google Meet or Microsoft Teams meeting transcript into a structured action-item breakdown, grouped per person, with deadlines resolved to real dates and ready-to-use JSON for kanban boards and calendars. Use this skill whenever the user pastes or uploads a meeting transcript (or recording transcription) and wants to know "who owes what," extract action items, follow-ups, or next steps, build a task list from a meeting, or generate kanban/calendar-ready task data from a call. Trigger this even if the user just says something like "can you pull the action items from this transcript" or shares a transcript with speaker names and timestamps and asks what everyone needs to do.
---

# Meeting Action Items

Extract per-person action items from a meeting transcript (Google Meet or Microsoft Teams export) and turn them into a single JSON file that's ready to feed into a kanban board and a calendar.

## Why this matters

Meeting transcripts are messy: people talk over each other, commitments are phrased casually ("I'll get that to you by Friday"), and deadlines are relative to the meeting date, not absolute. The value of this skill is doing the careful work of (1) figuring out who actually owns each task, (2) converting "Friday" or "end of next week" into a real ISO date using the meeting's own date as the anchor, and (3) shaping the result into the exact JSON structures needed downstream. Getting these three things right is what makes the output usable without manual cleanup.

## Step 1: Read the transcript and find the anchor date

Google Meet and Teams transcripts both interleave speaker name + timestamp + spoken text, though exact formatting varies by export type. Look for patterns like:

```
John Smith
10:03 AM
I'll send you the deck by end of day Friday.

Priya Patel  0:04:12
Yeah, I can review the budget numbers, probably done by next Wednesday.
```

Before extracting tasks, establish an **anchor date** — the actual calendar date of the meeting. Check, in this order:
1. A date in the transcript header/title (Google Meet and Teams exports often include this, e.g. "Weekly Sync - Transcript - July 29, 2026").
2. A date mentioned in the file name if one was uploaded.
3. If truly nothing indicates the date, ask the user for the meeting date rather than guessing — every relative deadline depends on getting this right.

Timestamps within the transcript (10:03 AM, 0:04:12, etc.) are usually elapsed/clock time during the call, not separate dates — use the anchor date for all of them unless the transcript spans multiple days.

## Step 2: Identify every participant

List every distinct speaker name in the transcript. This list matters even for people who never got assigned anything — per the output format below, everyone who spoke should appear in the final JSON, with empty task lists if nothing was assigned to them. Don't invent participants who weren't in the transcript, and don't drop someone just because they only spoke once.

## Step 3: Extract action items and assign ownership

Read through the transcript looking for commitments, assignments, and follow-ups. Ownership isn't always the speaker:
- **Self-commitment**: "I'll send the report by Friday" → task belongs to the speaker.
- **Direct assignment**: "Priya, can you own the vendor follow-up?" / "Yeah, I've got it" → task belongs to Priya, even though someone else raised it.
- **Third-person assignment**: "Let's have Marcus handle onboarding docs" with no objection → task belongs to Marcus.

If ownership is genuinely ambiguous (nobody confirms, or it's a vague "someone should look into this"), use your best judgment based on context, and lean toward attributing it to whoever is most clearly implicated by the conversation. Don't fabricate a task that wasn't actually discussed just to fill out the list.

For each task, work out:
- **A short title** — imperative, task-focused, under ~8 words (e.g. "Send Q3 deck to leadership", not "John said he would try to get the deck done soon").
- **A short description** — one sentence capturing the actual content/context of the ask, in your own words.
- **Priority** — infer from language and context:
  - `high`: explicit urgency ("ASAP", "urgent", "before the client call tomorrow", tied to a blocker)
  - `low`: explicitly deprioritized ("whenever you get a chance", "no rush", "nice to have")
  - `medium`: everything else (the default — most meeting action items are routine, not urgent or optional)
- **Deadline**, if one was stated or clearly implied. Resolve relative language against the anchor date from Step 1:
  - "by Friday" → the next Friday on/after the anchor date
  - "end of day [day]" → that date, but note it's still just a date (see format below)
  - "next week" → without a specific day, use a reasonable default like the Friday of next week, and mention this assumption to the user
  - "by end of month" / "by EOQ" → the actual last calendar day of that period
  - If no deadline was stated or implied at all, leave the task without a deadline — don't invent one.

## Step 4: Build the output JSON

Produce **one JSON file** grouping tasks by person. Every participant from Step 2 gets an entry, even if their lists are empty. Structure:

```json
{
  "meeting_date": "2026-07-29",
  "generated_at": "2026-07-31T09:15:00.000Z",
  "people": {
    "John Smith": {
      "kanban": [
        {
          "title": "Send Q3 deck to leadership",
          "description": "Share the finished Q3 performance deck with the leadership team.",
          "priority": "medium",
          "status": "todo"
        }
      ],
      "calendar": [
        {
          "title": "Send Q3 deck to leadership",
          "description": "Share the finished Q3 performance deck with the leadership team.",
          "priority": "medium",
          "status": "todo",
          "deadline": "2026-08-01T00:00:00.000Z"
        }
      ]
    },
    "Priya Patel": {
      "kanban": [],
      "calendar": []
    }
  }
}
```

Rules for populating this:
- `kanban` includes **every** task assigned to that person, whether or not it has a deadline.
- `calendar` includes only the tasks that have a resolved `deadline` — a calendar entry without a date isn't useful, so don't put date-less tasks here. It's fine and expected for `calendar` to have fewer entries than `kanban`.
- Every task that appears in `calendar` should also appear in `kanban` (kanban is the complete list; calendar is the subset with dates).
- `deadline` is always full ISO 8601 with time and `Z`, e.g. `2026-08-01T00:00:00.000Z`. When only a date was implied (not a specific time), use `T00:00:00.000Z`.
- `status` is always `"todo"` — these are freshly extracted tasks, not tasks anyone has started yet.
- `title` and `description` stay consistent between the kanban and calendar copies of the same task.
- If a person genuinely has zero tasks, both arrays stay empty (`[]`) — still include them in `people` per Step 2.

## Step 5: Deliver the file

Save the JSON to `/mnt/user-data/outputs/` (e.g. `action-items-<meeting-topic-or-date>.json`) and share it with `present_files`. Alongside the file, give a brief plain-language summary in chat — a couple lines per person, not a restatement of the whole JSON — so the user can sanity-check the extraction without having to open the file. Flag clearly any deadline you had to guess at (like a vague "next week") so the user knows to double check it.

If the transcript doesn't clearly indicate a meeting date and the user hasn't provided one, ask before proceeding — don't guess at a date silently, since it affects every deadline in the output.
