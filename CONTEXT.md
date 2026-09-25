# Kto idzie?

A planning platform that helps participants of a camp decide which activities to sign up for by showing, publicly, what other participants intend. Actual sign-up happens in a separate, external system. The app is only needed during the weeks before the camp while people decide.

## Camp structure

**Camp**:
A single event (e.g. a youth camp) of 3–5 camp days whose activities are shown in the app. The app is used for one camp at a time.
_Avoid_: Event, trip

**Camp day**:
One day of the camp. A participant can be registered for at most one activity per camp day.
_Avoid_: Slot, session

**Activity**:
Something to do at the camp (e.g. kayaking), with a name, a category (Camp Host, Kreatywne, Jedzenie, Gry, Media, Muzyka, Na Zewnątrz, Sport, Sporty Zimowe) and one logo image, entered manually by the organizer. Its real description lives in the event app; here we only see who goes where. A camp has about 20–30. An activity can be offered on several camp days. Activities outlive a camp, so they can be copied into the next one. Participants, offerings and picks are deleted when the camp ends.
_Avoid_: Event, workshop, session

**Offering**:
An activity available on specific camp day(s), optionally restricted by gender (e.g. "kayaking, day 2, girls only"). Every age bracket can pick every offering. Participants who are not eligible can't pick it and don't see it by default. A multi-day offering (up to the whole camp) takes up every camp day it covers. Participants choose offerings, not activities.
_Avoid_: Instance, occurrence, session

**Signup group**:
Who a participant registers as for an offering in the external system: **mentee** (every U15/U18 participant), **mentor taking part** or **mentor not taking part** (O18 only; chosen per pick, taking part by default).
_Avoid_: Role, category

**Capacity**:
The maximum number of places in each signup group of an offering, across *all* youth groups at the camp, not only ours. It can be unlimited. It is shown for information only and never blocks a pick.
_Avoid_: Limit, seats

**High demand**:
A flag the organizer sets on an offering that is expected to fill up fast, based on experience from past camps. It is shown for information only.
_Avoid_: Popular, hot

## People

**Participant**:
A member of the camp's closed youth group (about 50 people, all known to each other) who shows their intentions about activities. Has a gender and an age bracket, and is identified by their Telegram account. Joins by opening the app for the first time.
_Avoid_: User, attendee, member

**Age bracket**:
One of U15, U18, O18. It decides the participant's registration wave and signup group (O18 = mentor).
_Avoid_: Age group, category

**Organizer**:
A participant who can set up the camp, enter its activities and offerings, correct participants' data, and make other participants organizers.
_Avoid_: Admin, leader

**Youth group**:
Our ~50 participants. Other youth groups also attend the camp and compete for the same capacity, but they are invisible to the app.
_Avoid_: Team, community

## Planning

**Ranking**:
A participant's ordered list of the offerings they are considering for one camp day. #1 is what they would choose if everything went perfectly. It can include every offering they are eligible for. The app shows the positions as **Plan A, Plan B, …**: each plan counts only if the ones above it don't work out.
_Avoid_: Shortlist, preferences, votes

**Pick**:
One offering placed in a participant's ranking, with its rank and an optional condition. A multi-day offering is one pick that appears in the ranking of each day it covers, and it can have a different rank on each of those days.
_Avoid_: Choice, vote, interest, backup

**Condition**:
A requirement attached to a pick: specific named participants, or at least N other participants of the participant's own gender, who have the same offering as their current choice. It is *met* when this is true. For a multi-day pick it must be met on every day the pick covers.
_Avoid_: Dependency, rule

**Current choice**:
For a participant and a camp day: their highest-ranked pick whose condition is met right now. A multi-day pick can be the current choice only if it wins on every day it covers. Conditions are resolved together, so two participants whose conditions name each other both get that offering as their current choice.
_Avoid_: Result, effective pick

**Conflict**:
A multi-day pick that is outranked on one of its days by a pick the participant prefers on that day. The participant is warned and asked to resolve it.
_Avoid_: Clash, overlap

**Day status**:
How settled a participant is about a camp day. One of **Undecided** (empty ranking), **Wondering** (a ranking, not yet registered) or **Registered** (signed up externally for their current choice, which becomes #1 and ignores its condition; can be undone only after explicit confirmation).
_Avoid_: Stance, state

**Plan**:
All of a participant's rankings and day statuses for the camp.
_Avoid_: Schedule, selection

## Registration

**External registration**:
The actual first-come-first-served sign-up for an offering, done in a separate app. This app never replaces it.
_Avoid_: Enrollment, booking

**Registration wave**:
The moment an age bracket may start external registration, in the order U15 → U18 → O18, about a week or more apart. The organizer enters the dates, optionally with the date it closes (for information only). Earlier waves get first access to capacity.
_Avoid_: Deadline, window

**Planning period**:
The roughly 3 weeks around the registration waves when the app is in use. Picks can change at any time during it.
_Avoid_: Registration window
