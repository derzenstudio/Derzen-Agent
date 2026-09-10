# How to Build Your First Pipeline (No Coding Required)

This guide walks you through creating a pipeline step-by-step, as if you've never seen code before.

---

## What is a Pipeline?

A pipeline is like a recipe. You tell the computer:
1. "Do this first"
2. "Then do that"
3. "If something is true, go this way; otherwise, go that way"
4. "Finally, send the result to someone"

The computer follows your recipe automatically, as many times as you want.

---

## Getting Started

### Step 1: Open the Pipeline Builder

1. On the main dashboard, you'll see several cards
2. Click the card that says **"Build a Pipeline"**
3. You'll see three options:
   - **Start from a Template** (recommended for beginners)
   - **Build from Scratch**
   - **Describe What You Want** (let AI build it for you)

---

## Option A: Start from a Template (Easiest)

### Step 2: Choose a Template

You'll see 4 ready-made pipelines:

1. **Weekly Research Report**
   - Scrapes websites, AI analyzes data, emails summary to team
   - *Use this if you want automated weekly reports*

2. **Website Monitor with Alert**
   - Checks a website, AI decides if something changed, alerts you via WhatsApp
   - *Use this if you want to watch for changes*

3. **Daily AI Summary**
   - AI writes a summary, saves to file, emails it
   - *Use this if you want daily briefings*

4. **Research & Compare**
   - Reads two websites, AI compares them, saves comparison
   - *Use this if you want to compare things*

### Step 3: Customize the Template

Let's say you chose **"Weekly Research Report"**:

1. Click **"USE THIS →"** on the template card
2. You'll see the pipeline canvas with steps already connected:
   ```
   START → READ WEBSITE → ASK THE AI → SEND EMAIL → FINISH
   ```

3. **Change the website:**
   - Click on the blue "READ A WEBSITE" step
   - On the right panel, you'll see "Website address"
   - Change it from `https://news.ycombinator.com` to whatever site you want
   - Example: `https://techcrunch.com`

4. **Change what the AI does:**
   - Click on the purple "ASK THE AI" step
   - You'll see "What do you want the AI to do?"
   - Change it to your question
   - Example: "List the top 5 most important tech stories from this week"

5. **Change who gets the email:**
   - Click on the orange "SEND AN EMAIL" step
   - Change "Send to" to your email or team email
   - Change "Email subject" to whatever you want
   - The email body uses `{{ai_answer}}` which means "put the AI's answer here"

6. **Give your pipeline a name:**
   - At the top, change "Weekly Research Report" to "My Tech News Report"

7. **Save it:**
   - Click the **"SAVE PIPELINE"** button at the bottom
   - Your pipeline is now saved!

### Step 4: Run Your Pipeline

1. Click **"RUN NOW"** at the bottom
2. The pipeline will execute:
   - Opens the website
   - Reads the content
   - Sends it to the AI
   - AI writes the summary
   - Email is sent
3. You'll see a success message

### Step 5: Schedule It (Optional)

Want it to run automatically every Sunday?

1. After saving, you'll see options to schedule
2. Click **"Schedule this pipeline"**
3. Choose "Every week" and "Sunday" and "9:00 AM"
4. Save the schedule
5. Now it runs automatically every Sunday at 9 AM!

---

## Option B: Build from Scratch

### Step 2: Start with an Empty Canvas

1. Click **"Build from Scratch"**
2. You'll see an empty canvas with a grid
3. On the left, you'll see "AVAILABLE STEPS"

### Step 3: Add Your First Step

1. On the left panel, you'll see 9 types of steps:
   - **START HERE** (green) - Where the pipeline begins
   - **FINISH** (red) - Where the pipeline ends
   - **ASK THE AI** (purple) - Send a question to AI
   - **READ A WEBSITE** (blue) - Open and read a website
   - **SEND AN EMAIL** (orange) - Send an email
   - **SEND A WHATSAPP** (green) - Send a WhatsApp message
   - **SAVE A FILE** (gray) - Save text to a file
   - **WAIT** (yellow) - Pause for a few seconds
   - **MAKE A DECISION** (red) - If/else logic

2. **Every pipeline needs a START step:**
   - Click on **"START HERE"** in the left panel
   - It will appear on the canvas
   - Or drag it from the left panel onto the canvas

3. **Add more steps:**
   - Click on **"READ A WEBSITE"**
   - It will appear below the START step
   - Continue adding steps: **"ASK THE AI"**, **"SEND AN EMAIL"**

4. **Add a FINISH step:**
   - Click on **"FINISH"**
   - This tells the pipeline where to stop

### Step 4: Connect the Steps

Now you need to tell the pipeline what order to run the steps:

1. **Look at the START step:**
   - On the right side, you'll see a small circle
   - This is the "output" - where the step sends its result

2. **Look at the next step (READ A WEBSITE):**
   - On the left side, you'll see a small circle
   - This is the "input" - where the step receives data

3. **Connect them:**
   - Click the circle on the RIGHT side of START
   - Then click the circle on the LEFT side of READ A WEBSITE
   - A line will appear connecting them
   - This means: "After START, run READ A WEBSITE"

4. **Connect the rest:**
   - Click the right circle of READ A WEBSITE
   - Click the left circle of ASK THE AI
   - Click the right circle of ASK THE AI
   - Click the left circle of SEND AN EMAIL
   - Click the right circle of SEND AN EMAIL
   - Click the left circle of FINISH

5. **Your pipeline should look like:**
   ```
   START → READ WEBSITE → ASK AI → SEND EMAIL → FINISH
   ```

### Step 5: Configure Each Step

Click on each step to set it up:

**READ A WEBSITE:**
- Click the blue step
- On the right panel, you'll see "Website address"
- Enter the URL: `https://example.com`

**ASK THE AI:**
- Click the purple step
- You'll see "What do you want the AI to do?"
- Enter your question: `Summarize this website in 3 bullet points`

**SEND AN EMAIL:**
- Click the orange step
- Fill in:
  - "Send to": `your-email@example.com`
  - "Email subject": `Website Summary`
  - "Email body": `Here's the summary: {{ai_answer}}`
  - Note: `{{ai_answer}}` means "put the AI's answer here"

### Step 6: Save and Run

1. At the top, give your pipeline a name: "My First Pipeline"
2. Click **"SAVE PIPELINE"**
3. Click **"RUN NOW"** to test it
4. The pipeline will execute all steps in order

---

## Option C: Let AI Build It for You

### Step 2: Describe What You Want

1. Click **"Describe What You Want"**
2. You'll see a text box that says "Tell the AI what your pipeline should do"
3. Type in plain English what you want:
   - Example: "Every morning, check tech news websites, ask AI to summarize the top stories, and email the summary to my boss"
4. Click **"LET AI BUILD IT"**
5. Wait a few seconds while AI creates the pipeline
6. You'll see the pipeline appear on the canvas with all steps connected

### Step 3: Review and Customize

1. Look at the pipeline AI created
2. Click on each step to see what it does
3. Change anything you want:
   - Change the website URL
   - Change the AI question
   - Change the email address
4. Give it a name at the top
5. Click **"SAVE PIPELINE"**

---

## Understanding the Canvas

### The Grid
- The canvas has a dotted grid to help you align steps
- You can drag steps anywhere on the canvas

### The Circles
- **Left circle** = Input (where data comes IN)
- **Right circle** = Output (where data goes OUT)
- **Green circle** = Connected
- **Gray circle** = Not connected yet

### The Lines
- Lines show the flow of your pipeline
- **Gray line** = Normal flow (next step)
- **Green line** = YES path (if condition is true)
- **Red line** = NO path (if condition is false)
- Click a line to delete it

### The Colors
- **Green** = START / Success
- **Red** = FINISH / Error
- **Purple** = AI operations
- **Blue** = Web operations
- **Orange** = Email
- **Yellow** = Wait/Pause
- **Gray** = File operations

---

## Using Variables (Advanced)

You can use data from earlier steps in later steps:

### Example:
1. Step 1: READ A WEBSITE → saves result as `{{web_content}}`
2. Step 2: ASK THE AI → uses `{{web_content}}` in the question
3. Step 3: SEND EMAIL → uses `{{ai_answer}}` in the email body

### How to use variables:
- Type `{{variable_name}}` in any text field
- Common variables:
  - `{{web_content}}` = Content from READ A WEBSITE
  - `{{ai_answer}}` = Answer from ASK THE AI
  - `{{timestamp}}` = Current date/time

---

## Branching (Making Decisions)

### What is Branching?
Sometimes you want the pipeline to do different things based on a condition:
- "If the AI found something important, send an alert"
- "Otherwise, just save it to a file"

### How to Use Branching:

1. **Add a MAKE A DECISION step:**
   - Click "MAKE A DECISION" in the left panel
   - It has TWO outputs on the right:
     - Green circle = YES path
     - Red circle = NO path

2. **Set the condition:**
   - Click the MAKE A DECISION step
   - In "What should be true to go the YES path?", enter:
     - Example: `{{ai_answer}} contains "urgent"`

3. **Connect the YES path:**
   - Click the GREEN circle on the right
   - Click the left circle of the step you want to run if YES
   - Example: SEND A WHATSAPP (alert)

4. **Connect the NO path:**
   - Click the RED circle on the right
   - Click the left circle of the step you want to run if NO
   - Example: SAVE A FILE (just save it)

5. **Your pipeline looks like:**
   ```
   START → READ WEBSITE → ASK AI → DECISION
                                      ↓         ↓
                                   (YES)      (NO)
                                      ↓         ↓
                              WHATSAPP      SAVE FILE
                                      ↓         ↓
                                      └─→ FINISH ←─┘
   ```

---

## Testing Your Pipeline

### Test Individual Steps
1. Click on a step
2. In the right panel, you'll see "TEST THIS STEP"
3. Click it to see what that step would do
4. Useful for checking if your AI question works

### Test the Whole Pipeline
1. Click **"TEST PIPELINE"** at the bottom
2. The pipeline runs in "test mode"
3. You'll see what each step does
4. Nothing is actually sent/saved (safe to test)

### Run for Real
1. Click **"RUN NOW"** at the bottom
2. The pipeline executes all steps
3. Emails are sent, files are saved, etc.

---

## Saving and Loading

### Save Your Pipeline
1. Give it a name at the top
2. Click **"SAVE PIPELINE"**
3. It's saved to your computer
4. You can open it anytime

### Load a Saved Pipeline
1. Go back to the welcome screen
2. You'll see "YOUR SAVED PIPELINES"
3. Click on any pipeline to open it
4. Edit it or run it

### Delete a Pipeline
1. Open the pipeline
2. There's no delete button yet (coming soon)
3. Just don't use it

---

## Scheduling (Run Automatically)

### Set Up a Schedule
1. After saving your pipeline
2. Click **"Schedule this pipeline"**
3. Choose when to run it:
   - Every day at 9 AM
   - Every Monday at 8 AM
   - Every Sunday at 9 AM
   - Every hour
   - Custom schedule

### How Scheduling Works
- The pipeline runs automatically at the scheduled time
- You don't need to be at your computer
- Results are saved/emailed automatically
- You can check the logs to see if it ran

---

## Common Problems and Solutions

### "I can't connect the steps"
**Problem:** You click the circles but nothing happens

**Solution:**
1. Make sure you're clicking the RIGHT circle of one step
2. Then click the LEFT circle of the next step
3. The circles should turn green when connected
4. A line should appear between them

### "The AI doesn't understand my question"
**Problem:** The AI gives a weird answer

**Solution:**
1. Click the ASK THE AI step
2. Rewrite your question more clearly
3. Be specific: "List the top 5 news stories" instead of "Tell me about news"
4. Test the step to see if it works

### "The email didn't send"
**Problem:** You ran the pipeline but no email arrived

**Solution:**
1. Check the email address is correct
2. Make sure your email is in the approved contacts list
3. Check the logs: `C:\AI_Automation\Logs\server.log`
4. Test the email step individually

### "I made a mistake, how do I undo?"
**Problem:** You deleted something by accident

**Solution:**
1. Click **"UNDO"** at the top
2. You can undo multiple times
3. Or click **"CLEAR ALL"** to start over

---

## Tips for Success

### Start Simple
- Begin with 3-4 steps: START → DO SOMETHING → SEND RESULT → FINISH
- Get that working first
- Then add more complexity

### Test Often
- After adding each step, test it
- Don't build a huge pipeline and then test
- Fix problems early

### Use Templates
- Templates are proven to work
- Customize them instead of building from scratch
- Learn from how they're structured

### Name Your Steps
- Give your pipeline a clear name
- Describe what it does
- Future you will thank present you

### Check the Logs
- If something goes wrong, check the logs
- Location: `C:\AI_Automation\Logs\server.log`
- The logs tell you exactly what happened

---

## Example Pipelines

### Example 1: Daily News Summary
```
START
  ↓
READ WEBSITE (https://techcrunch.com)
  ↓
ASK AI (Summarize the top 3 stories)
  ↓
SEND EMAIL (to: me@company.com, subject: Daily Tech News)
  ↓
FINISH
```
**Schedule:** Every day at 8 AM

### Example 2: Competitor Monitor
```
START
  ↓
READ WEBSITE (https://competitor.com/blog)
  ↓
ASK AI (Did they announce anything new? Answer YES or NO)
  ↓
MAKE A DECISION (if {{ai_answer}} == "YES")
  ↓              ↓
(YES)           (NO)
  ↓              ↓
SEND WHATSAPP   SAVE FILE
(to: Boss)      (monitor_log.txt)
  ↓              ↓
  └──── FINISH ───┘
```
**Schedule:** Every hour

### Example 3: Weekly Report
```
START
  ↓
READ WEBSITE (https://internal-dashboard.com/metrics)
  ↓
READ WEBSITE (https://news-industry.com/weekly)
  ↓
ASK AI (Combine these into a weekly report with 5 key points)
  ↓
SAVE FILE (weekly_report.txt)
  ↓
SEND EMAIL (to: team@company.com, subject: Weekly Report)
  ↓
FINISH
```
**Schedule:** Every Friday at 4 PM

---

## You're Ready!

You now know how to:
- ✅ Create a pipeline from a template
- ✅ Build a pipeline from scratch
- ✅ Let AI build a pipeline for you
- ✅ Connect steps together
- ✅ Configure each step
- ✅ Use variables
- ✅ Add branching logic
- ✅ Test your pipeline
- ✅ Save and load pipelines
- ✅ Schedule automatic runs

**Next Steps:**
1. Try building a simple pipeline (3-4 steps)
2. Test it
3. Run it for real
4. Schedule it
5. Build something more complex

**Remember:** You can't break anything. The sandbox protects your files, and you can always undo mistakes.

Happy automating!
