# Volume comparisons

Everything card 3 of the post-workout summary needs. Replaces the earlier `volume-comparisons.md`, which had the weights and objects but no filenames and only one line each.

## How it works

Pick the heaviest entry at or below the session volume, so the card always reads as an achievement rather than a shortfall.

The card has three parts, top to bottom. An opener naming the object, "You lifted as much as a school bus" on screen and "@username lifted as much as a school bus" in the shared image, since the person on the screen is the subject and a stranger seeing the image is not. The volume figure, "34,030 lbs". Then the flavour, "All forty seats of it." Every line in the table below is written as "Object. Flavour." and the card splits it at the first sentence end: the first sentence supplies the object for the opener (with its article lowercased, so "a Smart car" and "an elephant" both read), the second is the flavour. "A T. rex. Never skipped leg day." splits after "rex", not after "T", so keep object names free of other abbreviations.

The object's own weight is never printed: the session sits somewhere above it, and showing both invites a comparison the two numbers do not support.

Pick one of the four lines at random per view. The same weight band should not say the same thing every time.

## Rules

Below 400 lb, skip the card entirely. A first session with one light set does not need to be told it moved a piano.

Above 80,000 lb, keep the semi truck. Do not multiply into "3 semi trucks", since multiples stop being picturable and that is the whole point.

Weights are stored in pounds, and a kg user's session volume is converted to pounds before the pick, so one table serves both.

Illustrations are 384px square PNGs with transparency, in `assets/images/comparisons/`. If a file is missing, render the card with the number and line alone rather than a broken image. Files will land incrementally.

## The table

| lb | slug | file |
|---|---|---|
| 400 | upright-piano | upright-piano.png |
| 700 | vending-machine | vending-machine.png |
| 1,000 | horse | horse.png |
| 1,400 | cow | cow.png |
| 1,800 | smart-car | smart-car.png |
| 2,400 | grand-piano | grand-piano.png |
| 3,000 | sedan | sedan.png |
| 4,000 | hippo | hippo.png |
| 5,000 | pickup-truck | pickup-truck.png |
| 7,000 | rhino | rhino.png |
| 9,000 | delivery-van | delivery-van.png |
| 12,000 | elephant | elephant.png |
| 15,000 | triceratops | triceratops.png |
| 18,000 | trex | trex.png |
| 25,000 | school-bus | school-bus.png |
| 35,000 | garbage-truck | garbage-truck.png |
| 50,000 | humpback-whale | humpback-whale.png |
| 80,000 | semi-truck | semi-truck.png |

## The lines

**upright-piano**
1. An upright piano. Somebody has to move those.
2. An upright piano. Stairs not included.
3. An upright piano. Try getting that round a corner.
4. An upright piano. Tuning is extra.

**vending-machine**
1. A full vending machine. Snacks and all.
2. A vending machine. Still fully stocked.
3. A vending machine. Nobody has shaken this one yet.
4. A vending machine. Coins included.

**horse**
1. A whole horse. Not a pony.
2. A horse. The actual animal.
3. A horse. It did not agree to this.
4. A horse. Roughly one furlong of unimpressed.

**cow**
1. A dairy cow. She is not amused.
2. A cow. A real, standing-there cow.
3. A cow. Milk not included.
4. A cow. All of it.

**smart-car**
1. A Smart car. Parking spot not included.
2. A Smart car. The little one.
3. A Smart car. You could almost carry it.
4. A Smart car. Barely counts as a car.

**grand-piano**
1. A grand piano. Lid open and everything.
2. A grand piano. Bench sold separately.
3. A grand piano. Eighty-eight keys of it.
4. A grand piano. Now find four friends.

**sedan**
1. A family sedan. With the kids in it.
2. A sedan. Four doors, full tank.
3. A sedan. Groceries in the boot.
4. A sedan. The whole thing, not just the engine.

**hippo**
1. A hippo. Do not try this in person.
2. A hippo. They are heavier than they look.
3. A hippo. Faster than you, too.
4. A hippo. Mostly just sitting in a river.

**pickup-truck**
1. A pickup truck. Empty bed, mind you.
2. A pickup. Before you load anything in.
3. A pickup truck. Tailgate down.
4. A pickup truck. Someone will ask to borrow it.

**rhino**
1. A rhino. Fully grown and unimpressed.
2. A rhino. Horn and all.
3. A rhino. Armor plating included.
4. A rhino. Two tons of bad mood.

**delivery-van**
1. A delivery van. Packages included.
2. A delivery van. Fully loaded.
3. A delivery van. Still three streets behind schedule.
4. A delivery van. Doors closed, thankfully.

**elephant**
1. An elephant. The whole elephant.
2. An elephant. Trunk to tail.
3. An elephant. It will remember this.
4. An elephant. Not the baby one.

**triceratops**
1. A triceratops. Horns included.
2. A triceratops. Built like a tank.
3. A triceratops. Fifteen thousand pounds of unbothered.
4. A triceratops. It had the bigger neck.

**trex**
1. A T. rex. Never skipped leg day.
2. A T. rex. The little arms did not help.
3. A T. rex. Sixty-six million years, still heavy.
4. A T. rex. It could not have done this.

**school-bus**
1. A school bus. Empty, thankfully.
2. A school bus. All forty seats of it.
3. A school bus. Every single row.
4. A school bus. Before anyone gets on.

**garbage-truck**
1. A garbage truck. On collection day.
2. A garbage truck. Route finished.
3. A garbage truck. Full load.
4. A garbage truck. Nobody wants to spot that one.

**humpback-whale**
1. A humpback whale. In one session.
2. A humpback whale. Fins and all.
3. A humpback whale. Out of the water, somehow.
4. A humpback whale. Twenty-five tons of it.

**semi-truck**
1. A loaded semi truck. Eighteen wheels of it.
2. A semi truck. Trailer full.
3. A semi truck. Cab, trailer, cargo, everything.
4. A semi truck. Legally the heaviest thing on the road.

## Notes

The semi truck line about being legally the heaviest is accurate in the United States, where 80,000 lb is the federal limit without a permit. It is the one line that would need changing if the app ever localises.

Volume totals reflect how much someone trains, not how strong they are. A high-rep session moves more total weight than a heavy low-rep one, so the card will sometimes tell a stronger lifter they moved less. Worth watching once real users see it, and a reason not to lean on this number as a measure of anything.
