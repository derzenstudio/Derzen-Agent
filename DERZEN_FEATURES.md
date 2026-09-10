# DERZEN - Still and always be DERZEN

## 🎨 Brand Update

The system has been rebranded to **DERZEN** with the tagline "Still and always be DERZEN". This branding appears throughout the interface:

- Main dashboard hero section
- Pipeline Builder header
- Page title in browser tab
- All documentation and guides

---

## 🆕 New Capabilities Added

### 1. Multiple URL Support in Web Scraping

**What Changed:**
The "READ WEBSITES" step now supports scraping multiple URLs in a single step.

**How to Use:**
- In the pipeline builder, add a "READ WEBSITES" step
- In the configuration panel, enter multiple URLs (one per line)
- Example:
  ```
  https://news.ycombinator.com
  https://techcrunch.com
  https://arstechnica.com
  ```
- The system will scrape all URLs and combine the data

**Use Cases:**
- Compare information across multiple news sources
- Aggregate data from different websites
- Build comprehensive reports from multiple sources

**Template Example:**
"Multi-Source Research Report" template demonstrates this feature with 3 URLs.

---

### 2. AI Browser - Interact with Online AI Services

**What Changed:**
New "BROWSE ONLINE AI" step that can interact with ChatGPT, Claude, Gemini, and Perplexity through their web interfaces.

**How It Works:**
- The system opens the AI service website in a browser
- Types your question into the chat interface
- Waits for the AI to respond (configurable wait time)
- Captures the response
- Can continue existing conversations (conversation mode)
- Acts like a human user - no API keys needed

**Configuration Options:**
- **AI Service**: Choose from ChatGPT, Claude, Gemini, or Perplexity
- **Prompt**: What to ask the AI
- **Wait Time**: How long to wait for response (default: 30 seconds)
- **Conversation Mode**: Continue an existing conversation or start fresh

**Use Cases:**
- Compare responses from different AI services
- Use more powerful AI models without API costs
- Access AI services that don't have public APIs
- Maintain conversation context across multiple queries

**Template Example:**
"Compare AI Services" template shows how to ask the same question to ChatGPT, Claude, and Gemini, then compare their answers.

**Technical Details:**
- Uses Playwright browser automation
- Handles dynamic content loading
- Waits for AI response completion
- Extracts text from chat interface
- Supports login/authentication (manual setup required)

---

### 3. Social Media Analysis

**What Changed:**
New "ANALYZE SOCIAL MEDIA" step that can search and analyze posts from Twitter, Instagram, LinkedIn, and Facebook.

**How It Works:**
- Searches the selected platform for your query
- Retrieves recent posts matching your search
- Analyzes sentiment (positive/negative/neutral)
- Identifies trends and patterns
- Returns structured data for further processing

**Configuration Options:**
- **Platform**: Twitter/X, Instagram, LinkedIn, or Facebook
- **Query**: What to search for (keywords, hashtags, mentions)
- **Post Count**: How many posts to analyze (default: 10)
- **Analyze Sentiment**: Enable/disable sentiment analysis (default: enabled)

**Use Cases:**
- Monitor brand reputation
- Track trending topics in your industry
- Analyze customer sentiment
- Research competitor social media presence
- Gather social media insights for reports

**Template Example:**
"Social Media Trend Monitor" template searches Twitter for brand mentions and alerts you if sentiment is negative.

**Technical Details:**
- Uses platform-specific APIs or web scraping
- Handles rate limiting and authentication
- Performs sentiment analysis using AI
- Returns structured data with post content, engagement metrics, and sentiment scores

---

## 📋 Updated Templates

Four new templates demonstrate the new capabilities:

### 1. Multi-Source Research Report
- Scrapes 3 different tech news websites
- Analyzes all data with local AI
- Emails comprehensive summary

### 2. Compare AI Services
- Asks the same question to ChatGPT, Claude, and Gemini
- Compares their responses
- Saves comparison to file

### 3. Social Media Trend Monitor
- Searches Twitter for brand mentions
- Analyzes sentiment
- Alerts via WhatsApp if negative sentiment detected

### 4. Comprehensive Research Pipeline
- Scrapes multiple websites
- Analyzes social media trends
- Uses online AI (ChatGPT) for deep analysis
- Saves report and emails to stakeholders

---

## 🔧 Technical Implementation

### Multiple URLs
```python
# In web_scrape node
urls = config['urls'].split('\n')  # Split by newlines
for url in urls:
    content = scrape_website(url.strip())
    all_content.append(content)
combined_data = '\n\n'.join(all_content)
```

### AI Browser
```python
# In ai_browser node
browser = await launch_browser()
page = await browser.new_page()

# Navigate to AI service
await page.goto(f"https://{config['ai_service']}.com")

# Type prompt
await page.fill('textarea', config['prompt'])
await page.click('button[type="submit"]')

# Wait for response
await page.wait_for_selector('.response', timeout=config['wait_seconds'] * 1000)

# Extract response
response = await page.inner_text('.response')
```

### Social Media Analysis
```python
# In social_analyze node
posts = search_platform(config['platform'], config['query'], config['post_count'])

if config['analyze_sentiment']:
    for post in posts:
        sentiment = analyze_sentiment(post['content'])
        post['sentiment'] = sentiment

return {
    'posts': posts,
    'total_count': len(posts),
    'sentiment_summary': calculate_sentiment_summary(posts)
}
```

---

## 🚀 Getting Started

### Quick Start with New Features

1. **Try Multiple URLs:**
   - Open Pipeline Builder
   - Choose "Multi-Source Research Report" template
   - Customize the URLs to websites you want to scrape
   - Run the pipeline

2. **Try AI Browser:**
   - Open Pipeline Builder
   - Choose "Compare AI Services" template
   - Change the question to something you want to compare
   - Run and see how different AIs respond

3. **Try Social Media Analysis:**
   - Open Pipeline Builder
   - Choose "Social Media Trend Monitor" template
   - Change the search query to your brand or topic
   - Run and see sentiment analysis results

### Advanced Usage

Combine all three features in a single pipeline:
```
START
  ↓
READ WEBSITES (multiple URLs)
  ↓
ANALYZE SOCIAL MEDIA (Twitter search)
  ↓
BROWSE ONLINE AI (ChatGPT deep analysis)
  ↓
SAVE FILE (comprehensive report)
  ↓
SEND EMAIL (distribute to team)
  ↓
FINISH
```

---

## 📊 Performance Expectations

### Multiple URLs
- **Time**: ~5-10 seconds per URL
- **Example**: 3 URLs = 15-30 seconds total
- **Note**: Depends on website complexity and response time

### AI Browser
- **Time**: 30-60 seconds per query (includes wait time)
- **Example**: Comparing 3 AI services = 90-180 seconds
- **Note**: Can be faster if AI responds quickly, slower if busy

### Social Media Analysis
- **Time**: 10-30 seconds per platform
- **Example**: Analyzing 10 posts = 10-15 seconds
- **Note**: Depends on platform API response time and rate limits

---

## 🔐 Security Considerations

### AI Browser
- **Authentication**: You must manually log in to AI services first
- **Session Management**: Browser sessions are saved in `C:/AI_Automation/BrowserData`
- **Rate Limiting**: Be careful not to exceed service rate limits
- **Terms of Service**: Ensure your usage complies with each service's ToS

### Social Media Analysis
- **Authentication**: Some platforms require login (Instagram, Facebook)
- **Rate Limiting**: Built-in delays to avoid being blocked
- **Data Privacy**: Analyzed data stays local, not sent to external servers
- **Platform Policies**: Ensure compliance with platform scraping policies

### Multiple URLs
- **Sandboxed**: All downloads restricted to `C:/AI_Automation/Downloads`
- **Validated**: URLs are validated before scraping
- **Logged**: All scraping activity is logged

---

## 📝 Example Pipelines

### Example 1: Competitive Intelligence
```
START
  ↓
READ WEBSITES (competitor1.com, competitor2.com, competitor3.com)
  ↓
ANALYZE SOCIAL MEDIA (Twitter: "competitor brand name")
  ↓
BROWSE ONLINE AI (ChatGPT: "Analyze this competitive data and identify strengths/weaknesses")
  ↓
SAVE FILE (competitive_analysis.txt)
  ↓
SEND EMAIL (strategy-team@company.com)
  ↓
FINISH
```
**Schedule**: Every Monday at 8 AM

### Example 2: Content Research
```
START
  ↓
READ WEBSITES (industry-blog.com, news-site.com, research.org)
  ↓
ANALYZE SOCIAL MEDIA (LinkedIn: "industry trends 2026")
  ↓
BROWSE ONLINE AI (Claude: "Create a content calendar based on these trends")
  ↓
SAVE FILE (content_calendar.txt)
  ↓
SEND WHATSAPP (Content Team: "New content calendar ready!")
  ↓
FINISH
```
**Schedule**: Every Friday at 4 PM

### Example 3: Brand Monitoring
```
START
  ↓
ANALYZE SOCIAL MEDIA (Twitter: "your brand name", 20 posts)
  ↓
BROWSE ONLINE AI (Gemini: "Summarize sentiment and key themes")
  ↓
MAKE A DECISION (if sentiment is negative)
  ↓              ↓
(YES)           (NO)
  ↓              ↓
SEND WHATSAPP   SAVE FILE
(Crisis Team)   (weekly_report.txt)
  ↓              ↓
  └─── FINISH ───┘
```
**Schedule**: Every 4 hours

---

## 🎯 Best Practices

### Multiple URLs
- Start with 2-3 URLs to test
- Ensure URLs are accessible and don't require authentication
- Use URLs with similar content structure for better comparison
- Add delays between requests to avoid overwhelming servers

### AI Browser
- Test with simple questions first
- Increase wait time if responses are slow
- Use conversation mode for follow-up questions
- Log in to AI services manually before running pipelines
- Be mindful of rate limits (don't run too frequently)

### Social Media Analysis
- Start with small post counts (5-10) to test
- Use specific, targeted queries for better results
- Combine with AI analysis for deeper insights
- Monitor for platform changes that might affect scraping
- Respect platform rate limits and terms of service

---

## 🔮 Future Enhancements

Planned features for future releases:
- Support for more AI services (Copilot, Mistral, etc.)
- Additional social media platforms (TikTok, Reddit, YouTube)
- Image and video content analysis
- Automated login/credential management
- Visual sentiment analysis charts
- Export to multiple formats (PDF, DOCX, PPTX)
- Integration with more messaging platforms (Slack, Teams)

---

## 📞 Support

For issues or questions:
- Check logs: `C:\AI_Automation\Logs\server.log`
- Review PIPELINE_USER_GUIDE.md for general pipeline help
- Ensure all environment variables are configured in .env
- Verify browser sessions are active for AI Browser and Social Media features

---

**DERZEN** - Still and always be DERZEN
