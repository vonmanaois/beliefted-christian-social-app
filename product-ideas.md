# Product Ideas

## Chat (Draft Outline)

### Core Rules (Cost Control)
- Mutual followers only.
- Realtime only inside /messages.
- Text-only to start.
- Load latest 20–30 messages with pagination.

### Data Model (MongoDB)
**Conversation**
- _id
- participants: [userId, userId] (sorted)
- lastMessageText
- lastMessageAt
- unreadCountByUser: { [userId]: number }

**Message**
- _id
- conversationId
- senderId
- text
- createdAt

### API Routes
- POST /api/conversations: create only if mutual followers.
- GET /api/conversations: list user conversations sorted by lastMessageAt.
- GET /api/messages?conversationId=...&cursor=...: load latest 20–30.
- POST /api/messages: create message, update lastMessage, increment unread.

### Realtime Strategy (Budget Friendly)
**Option A (MVP, cheapest)**
- Poll every 10–20 seconds only on chat screen.

**Option B (Still cheap)**
- SSE/WebSocket only inside /messages page.
- Connection opened only while page is active.

### Unread Counts
- Store per user in Conversation.unreadCountByUser.
- Reset to 0 when user opens conversation.

### UI Plan
- /messages: list conversations with unread count.
- /messages/[conversationId]: thread view with bubbles, load older.

### Best-Practice Extras (Optional)
- Rate limit sends (1–2 per second).
- Sanitize message content.
- Add report/block later.

## Christian Community Feature Ideas
- Prayer reminders.
- Prayer updates from the original author.
- Answered prayer badge + testimony highlight.
- Daily verse + reflection prompt.
- Small groups (private group feed).
- Prayer circles (invite-only list).
- Encouragement reactions (amen/pray/heart).
- Scripture tagging on posts.
- Testimony page (long form by theme).
- Simple event board.
