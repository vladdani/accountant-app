# 🧮 Time Saved Estimator – PRD (CariNota)

## 📌 Overview

**Goal:**  
Create an engaging, emotional calculator that helps users visualize how much time is wasted searching for documents — and how much time CariNota can give back.

Focus is on **time**, not money. Designed to show clear “Before vs After” using real data and emotional impact (emoji reactions).

---

## ✅ Objectives

- Quantify time lost each month on document search
- Emphasize the transformation with CariNota
- Visual and emotional storytelling using emoji reactions
- Clear CTA and zero-learning-curve interaction

---

## 📥 User Inputs

1. `Number of documents processed per month` (Numeric Input, default: 200)
2. `Number of people searching documents` (Numeric Input, default: 1)

> All inputs are optional but prefilled with realistic average values

---

## 🔄 Switch: Before vs After

Add a **toggle switch** (pill style):

```txt
[ Before Using CariNota ]   |   [ ✅ After Using CariNota ]

Logic Behind the Switch

Before CariNota:
	•	18 minutes per document (based on Gartner research)

After CariNota:
	•	Estimated 1 minute per document (AI finds and opens instantly)

Calculations:

// BEFORE
beforeMinutes = docsPerMonth * 18 * teamSize;
beforeHours = Math.round(beforeMinutes / 60);

// AFTER
afterMinutes = docsPerMonth * 1 * teamSize;
afterHours = Math.round(afterMinutes / 60);

// TIME SAVED
timeSaved = beforeHours - afterHours;



⸻

📊 Output Display

If “Before” Selected:

⏱️ Your team wastes about 162 hours per month just searching for documents.
🤯 That’s a whole month of work lost to chaos.

If “After” Selected:

✅ With CariNota, your team could spend just 9 hours searching.
💡 That’s 153 hours saved — every month.
🎉 Time to do work that really matters.



⸻

🤯 Emoji Reaction System

Hours Saved	Emoji	Caption
0–20	🙂	A few coffee breaks saved ☕
21–50	😐	A full week unlocked 🔓
51–100	😫	A part-time job’s worth of time gained!
101–150	😱	Huge time drain recovered 🚿
151+	🤯	Transformative savings. Let’s go! 🚀



⸻

🧠 Extra Elements
	•	📈 Animated Progress Bar comparing Before vs After
	•	🧩 Tooltip: “Based on Gartner research: 18 minutes to find a doc”
	•	🧪 CTA Button: “Try CariNota Free For 14 days”

⸻

🖥 UI/UX Notes
	•	Mobile-first layout
	•	Responsive slider/input for documents and team size
	•	Toggle should animate or highlight differences when switched
	•	Large fonts, emoji reactions, and short impactful captions

⸻

🔜 Future Ideas
	•	Save/share personalized results (encourages virality)
	•	Visual timeline: “What else could you do with 153 hours?”
	•	Integrate with onboarding: pre-fill data from usage


🔧 Technical Requirements:
	•	Should be embeddable as a component on the marketing site.
	•	Same stack we use already - Next.js preferred (based on current stack).
	•	No backend needed — all client-side.
   	•	Propose which shadcn components we can use: https://ui.shadcn.com/blocks

    ✍️ Copy/Labels Suggestions:

Headline:
“⏱️ How Much Time Can You Save With CariNota?”

Inputs:
	•	“How many documents do you handle each month?”
	•	“How long does it usually take to find each file?”
	•	“How many people are doing this?”
	•	“What’s their hourly rate?” (optional)

Output:
	•	“You’re spending ~XX hours/month just searching for files.”
	•	“CariNota can cut this down by 90%.”
	•	“That’s XX hours or Rp XX saved.”
```
