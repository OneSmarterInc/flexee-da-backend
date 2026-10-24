# FLEXEE DA faculty guide

This guide explains how a FLEXEE DA course runs and how it is scored. Where a figure depends on a course setting, the guide says so. Where it does not, the figure is the same in every course.

## 1. What the simulation is

Each team runs one firm in a supply chain. The firm sells two products, P1 (Standard) and P2 (Premium), in three regions: East, Central and West. Every quarter the team decides production, prices and marketing, and the engine works out what happened.

Over the course, six analytics modules open one at a time. Each module gives the team a new kind of decision, and the team's results start to depend on its own analysis. The modules are described in section 5.

A course has three firms unless the course is set up with a different number.

## 2. How a course runs

1. An admin creates the course and chooses the time zone it runs in. Every deadline uses that time zone.
2. The admin deploys the course to faculty. Faculty invite students, place them in firms and deploy the course to students.
3. Deploying to students opens the first student quarter. The course becomes Running and the first deadline starts counting.
4. Quarters 1 to 3 are history. The engine generates them, and students do not decide in them. Students decide from Quarter 4.
5. Orientation quarters come first. Teams make operational decisions only: production, prices and marketing. The number of orientation quarters depends on the schedule preset (section 3).
6. After orientation, the analytics modules open on the schedule.

A course has 11 quarters unless the course is set up with a different length.

## 3. The schedule presets

Faculty choose a preset when the course is set up. The table shows the first quarter in which each module opens.

| Preset | Orientation quarters | Demand Science | Supplier Analytics | Customer Intelligence | Network Design | Product Innovation | Market Expansion |
|---|---|---|---|---|---|---|---|
| Basic supply chain | 0 | not used | not used | not used | not used | not used | not used |
| Short course | 1 | Q5 | Q6 | not used | not used | not used | not used |
| Standard course | 2 | Q6 | Q7 | Q8 | Q9 | Q10 | Q11 |
| Long course | 3 | Q7 | Q9 | Q11 | Q13 | Q15 | Q17 |

- A module opens only if the course is long enough to reach its quarter. For example, in an 11-quarter Long course, Customer Intelligence opens in Quarter 11 and the three modules after it are not used.
- A module marked "not used" is never open in that course.
- Custom lets faculty choose the opening quarter of each module and the number of orientation quarters (0 to 6). A module cannot open before Quarter 4 plus the orientation quarters.
- The schedule is locked once the course is deployed to students.

## 4. Deadlines and closing a quarter

- Each quarter closes at 11:59 PM course time. The quarter length is a course setting: it is the number of calendar days the quarter stays open. A course uses 14 days unless it is set up with a different length.
- A quarter closes on its own within about 5 minutes of the deadline. A check runs every 5 minutes, and opening the course also triggers it. Faculty can close a quarter sooner by clicking Advance.
- A decision saved or submitted after the deadline is refused.
- Teams that have not submitted get a reminder email once, when the deadline is less than 24 hours away.
- When a quarter closes, a team's saved draft is submitted as it stands. A team with no draft plays on last quarter's decisions, and a one-off emergency order is not repeated.
- A quarter played on last quarter's decisions counts as a missed quarter in the outcome (section 8). A draft submitted at the deadline does not.
- Faculty can extend a quarter by whole days. The deadline keeps its 11:59 PM time, and every later quarter moves by the same number of days.

## 5. The six modules

Students open each module in the Workbench. Each module has a data file (`data.csv`) and an assignment (`assignment.docx`) to download. While a module is locked, its decisions stay at their starting settings and the student cannot change them.

**Demand Science.** Students forecast regional demand using historical data. When it is open, the team enters a forecast for each region and says whether it is its own estimate or a forecasting model's output. While locked, the forecast stays at its starting setting: 80,000 units for East, 70,000 for Central and 50,000 for West.

**Supplier Analytics.** Students select suppliers using total cost of ownership analysis. When it is open, the team picks a main supplier and an optional second supplier, splits the order between them and sets the global order. While locked, the team uses supplier SUP001 (GlobalTech Mfg, China) alone, at a global order of 600,000 units.

**Customer Intelligence.** Students segment customers and allocate marketing investment. When it is open, the team splits its marketing across four customer segments. While locked, the segments stay at 25% each. The marketing budget itself is an operational decision and is open from the start.

**Network Design.** Students design the distribution network for service and cost. When it is open, the team decides on a Central and a West distribution centre. While locked, the firm has no distribution centres.

**Product Innovation.** Students decide whether and how to launch the P3 product. When it is open, the team chooses whether to launch, the configuration (Standard or Premium), the price and the production. While locked, there is no P3.

**Market Expansion.** Students enter international regions based on NPV analysis. When it is open, the team decides whether to enter each of three new regions and forecasts demand in it. The regions are Canada, the EU (Germany) and APAC (Japan). While locked, the firm enters no new regions.

## 6. Forecasts: your own estimate or a model

With Demand Science open, each region's forecast is either the team's own estimate or the output of a forecasting model. The team says which one it used.

- After the quarter closes, the engine compares each forecast with the demand that actually happened and records the forecast's accuracy. Accuracy is 100% minus the average percentage error across the three regions, never below 0%.
- The record keeps which kind of forecast it was: the team's own estimate, a forecasting model, or last quarter's figures (used for the history quarters).
- The accuracy chart compares the two kinds. Faculty can show all firms on it or one firm.
- Forecast accuracy feeds the Learning perspective of the scorecard (section 7).

## 7. The measures and the scorecard

Every quarter, each firm gets four scores from 0 to 100, one for each perspective. The overall score is the average of the four.

**Financial** has four parts: net income (up to 30 points), revenue (25), gross margin (25) and cash (20). Each part earns full points at its target.
- Net income target: $5,000,000 a quarter.
- Revenue target: $70,000,000 a quarter.
- Gross margin target: 35%.
- Cash target: $20,000,000.
- The net income and revenue targets scale with the season, so a good quarter in a slow season scores like a good quarter in a busy one.

**Customer** has four parts: customer satisfaction (up to 30 points), market share (25), fill rate (25) and a fixed 20 points.
- Customer satisfaction target: 85.
- Market share target: 35%.
- Fill rate target: 95%.

**Process** has four parts: perfect orders (up to 30 points), capacity use (25), on-time delivery (20) and a fixed 22 points.
- Perfect order target: 90%.
- Capacity use earns full points between 70% and 85%.
- On-time delivery earns full points at 95%.

**Learning** is about forecasting: how accurate the firm's forecasts are, and whether they are improving.
- Accuracy earns up to 60 points: none at 50% or lower, all 60 at 90% or higher.
- The trend against last quarter earns up to 40 points: none at 5 points worse or more, 20 when flat, all 40 at 5 points better or more. A firm at 90% accuracy or higher keeps the full 40. A firm with no earlier quarter gets 20.

**Cash and credit.** A firm starts with $50,000,000 in cash unless the course is set up with a different amount.
- The base credit line is $50,000,000. A firm's creditworthiness tier changes it: 2.0 times for Excellent, 1.5 for Good, 1.0 for Fair, 0.5 for Poor and 0.25 for Distressed.
- Below $10,000,000 in cash, the firm borrows automatically. Above $20,000,000, it repays 50% of the excess.
- Borrowing above the limit costs a 2% fee. At 150% of the limit, the firm is forced to sell 10% of its inventory and recovers 50% of its value.

## 8. Outcomes

Students do not get a grade or a rank. Each firm gets an outcome, and the tests that decided it. The outcome describes what happened. It is not a grade.

The four tests use the four perspective scores. Only the student quarters count: Quarter 4 to the last closed quarter. Quarters 1 to 3 are history and do not count.

| Test | Met when |
|---|---|
| Financial | The average Financial score is 70 or more |
| Customer | The average Customer score is 70 or more |
| Process | The average Process score is 70 or more |
| Learning | The average Learning score is 70 or more |

The outcome follows from how many tests are met:

| Tests met | Outcome |
|---|---|
| 4 | All four perspectives met |
| 3 | Three of four perspectives met |
| 2 | Two of four perspectives met |
| 0 or 1 | Most perspectives missed |

A firm that missed more than half of the student quarters so far gets the outcome "Incomplete" instead, whatever its tests show. A missed quarter is one played on last quarter's decisions. Exactly half missed is not Incomplete.

Students see the outcome and one line per test with the figure, for example "Financial: your average was 76, above the 70 needed." Faculty see the same outcome for each firm, and a column of missed quarters. The outcome is not available until Quarter 4 has closed.

## 9. Reading the faculty pages

- **Faculty portal.** Lists your courses with their status. Open one to manage it.
- **Course page.** The control centre: invite students, see their progress, advance or extend a quarter, and open the other pages.
- **Setup.** Four steps in order: invite students, schedule the modules, place students in firms, then deploy to students. The schedule step is locked after deployment.
- **Invitees.** Every invitation and its state: waiting for a reply, accepted, declined or expired. You can resend waiting and expired invitations.
- **Students.** Everyone enrolled, with their firm and state. Open a student to see their details, block or unblock them or update their payment.
- **Firm allocation.** Place each student in a firm.
- **Performance overview.** Compares firms across quarters with charts, and a leaderboard showing each firm's outcome and missed quarters. Pick a quarter to see standings as of then.
- **Firm dashboard KPIs.** The four perspective scores for each firm in each quarter, with the leader in each column.
- **Firm page.** One firm's results and its team members.

Reporting is an admin page. It shows the address of the reporting connector and the Claude connections an admin approved.
