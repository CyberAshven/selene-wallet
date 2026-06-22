# Selene Contributor's Guide

## Welcome & Getting Started

We love contributors! Welcome!

- If you haven't already cloned the repository and started running a local copy of the app in your browser, do that first by following the instructions in the README.

- In order to submit a Merge Request, you'll need to register for an account on the XULU.TECH Gitlab Instance. Contact Kallisti in order to have your account approved.

- If you have any questions, feel free to ask in [the Telegram group](https://t.me/+MMbV2KEPFt84MDQ8).

## Your First Ticket 

1. Look in the [Issue Tracker](https://git.xulu.tech/selene.cash/selene-wallet/-/issues) or [Milestones](https://git.xulu.tech/selene.cash/selene-wallet/-/milestones) for a ticket that appeals to you.
    - Some tickets have a Weight attached to them, notated in brackets (e.g. "[1] Add ability to check stats over longer time frames" has a weight of 1).
    - Weight indicates an estimate of the time effort required to complete the ticket. See more details in the "Bounties" section of this document.

2. Contact Kallisti before starting the work to validate scope, requirements, and approach.
    - We are not liable for any of your time wasted if you do not communicate with Kallisti.

3. Checkout a new branch based off of the `staging` branch. 
    - Use a name format like `###-short-description`.
    - e.g. for "#446 Persist Transaction Memos on Rebuild" use a branch name like `446-persist-memos`.

4. Feel free to ask Kallisti any questions about the work as you go.

5. When ready for review, open a Merge Request and set Kallisti as the Reviewer.

6. Feel free to include a change adding yourself as a contributor on the Credits page in the app!

## Merge Request Expectations

- All Merge Requests are subject to review and are not guaranteed to be approved.

- Merge Requests will be reviewed as soon as possible, but please allow up to 1-3 business days for each round of review.

- Screenshots and/or video showing any changes are preferred and will help accelerate the review process.

- Try to do some self-review by reading the diff of the changes yourself. If there's anything you'd like to note or highlight about the changes, do so in the comments.

- Do your best to minimize the amount of changes required to resolve the ticket. Smaller, more thoughtful MRs are more likely to be approved.
    - Large MRs will probably be rejected immediately, especially if you did not communicate with Kallisti beforehand.
    - Recommended Reading: 
        - _The Pragmatic Programmer_ by Andrew Hunt & David Thomas
        - _Working Effectively With Legacy Code_ by Michael Feathers

- It is expected that you are able to answer "why" each and every line of code exists. If you can't explain your decisions, your merge request will be rejected.

- Use of AI code generation tools is discouraged\*, but not prohibited.
    <details><summary>Clarity on AI Code Generation Policy</summary>

    AI code generation is fine IF it produces a concise, effective PR that meets review standards.

    The problem with AI is low-effort generating a load of spaghetti, unrelated changes, comments/noise or coding patterns that the actual coder would not have independently used at their level of capability.

    In other words: Feel free to use, but use wisely. It is essential for any AI generated code to be self-reviewed by the MR owner before submission to ensure they clearly understand, cannot simplify & can explain all of the changes made - however they were incepted.
    </details>

### Code Style Guidelines

- Use descriptive names for variables and functions.
    - Do not use anonymous functions for `useEffect`.
    - Instead, use a descriptive named function. Example:
        ```
        useEffect(
          function handleInstantPay() {
            // ...
          }
        );
        ```

- Use TypeScript type annotations where possible.

- Boolean variable names must begin with `is`, `should`, `has`, `did`, or `will`.

- `import React from "react"` is not necessary.

- The linter must succeed in order for your merge request to be approved.

### Package/Dependency Guidelines

Each new package adds dependency risk & bundle size. Packages must meet a high bar of utility & necessity to be justified.

- Minimize adding new dependencies/packages. Only do so if strictly necessary.

- Do research on the package you intend to install. Make sure it's the best option available.

- Prioritize packages with minimal footprint, which should be measured in KILOBYTES, not megabytes.

- Prioritize packages that do one thing and do it well.

- Prioritize packages that can stand the test of time with minimal maintenance/technical debt.

- Package installation must be its own commit.


### Managing Side Effects

- Prefer pure functions unless side effects are neccesary.

- Avoid use of top-level scope unless strictly necessary.

## Bounties

There are bounties (in BCH of course) available for some desired features, ask in the Telegram group.

### Bounty Specification

Will be negotiated on a case by case basis, but some requirements for bounty payout that have proven valuable to make explicit from the beginning:

- No degredation in wallet performance, responsiveness, maintainability, significant bundle size increases or other "anti-progress" in the useability of the software, except where discussed otherwise as relevant to the feature at hand
- No introduction of new bugs or regressions
- Compliance with the project's style and PR guidelines, as specified below. Don't fret, review will help with this!
- Depending on the quality of code and feature, 1-2 rounds of review (and follow up revisions) should be expected, potentially more.

As relevant to the issue at hand, screen designs or non-functional UI scaffold branches and other specification material will be provided. This is a developing process to determine what is best included.

These points aren't set out to discourage contributors, but to appropriately set expectations that Selene is aiming to maintain a high standard of engineering and bounty payouts will be granted in alignment with that.

#### Points assignment

```
0.16 = quick fix = 1/2 hour
1 = half a day = 3 hours
2 = one day = 6 hours
3 = a couple of days = 12 hours
5 = a week = 30 hours
8 = two weeks = 60 hours
... larger features will of course be broken down into tickets for an epic, or negotiated separately.
```

Selene indicates assigned bounty-points in a Fibonnaci style sequence (which roughly approximates the estimated hours required / complexity / difficulty of task). These are noted in the issue ticket title with a preceding number in square brackets. e.g. `[5] Create a Selene static homepage`. Some time for testing, adapting to review etc. is considered in the initial estimation. Payment per bounty point is negotiated on a case-by-case basis depending on a number of factors (such as historical reliability in delivering Selene tickets and working with the Selene team, agreements about batch jobs of tickets etc.). There is some leeway for some tickets (especially 2 points or less) possibly being completeable faster than the indicated hours, and some longer tickets being a little more - this averages out over time for regular contributors. Tickets are paid based on points, not time to complete, regardless.

#### Code review

- Selene reviewers will use a system of "ASCII annotations" to prefix comments. This system comes from commercial experience with developers creating conflict over the severity or intent of context-less and tone-free typed review comments. See [these Google Slides](https://docs.google.com/presentation/d/1AA-ddE828xhXMaGKUp21vBMx20q9xOArw2-TuzkL3xM/edit?usp=sharing) for examples/details.

```
-* = Suggestion, small style nitpicks or tweaks, [typically] 2-6 / review, merge non-blocking
-? = Question, reviewer needs a bit more clarity, [typically] 0-2 / review, merge blocking
-! = Critical, severe bug introductions or security issues, [typically] 0-1 / review, merge blocking
-+ = Recognition, encouragement and praise of smart or cool code, [typically] 0-3 / review, merge non-blocking
```

