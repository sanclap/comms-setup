# EDXSO Registration Webhook — Integration Guide

## Overview

When a user registers on your website, send a POST request to this endpoint.
EDXSO Comms will:
1. Save the registrant to the database
2. Instantly send a confirmation **Email**
3. Instantly send a confirmation **WhatsApp** message (if phone provided)

---

## Endpoint

```
POST https://YOUR_VERCEL_URL/api/webhook/register
```

### Health Check (GET)
```
GET https://YOUR_VERCEL_URL/api/webhook/register
→ { "status": "ok" }
```

---

## Authentication

Include the webhook secret in the Authorization header:

```
Authorization: Bearer YOUR_WEBHOOK_SECRET
```

Or as a query param:
```
POST /api/webhook/register?secret=YOUR_WEBHOOK_SECRET
```

Set `WEBHOOK_SECRET` in your Vercel environment variables.
Share the same value with your website team.

---

## Request

### Headers
```
Content-Type: application/json
Authorization: Bearer YOUR_WEBHOOK_SECRET
```

### Body
```json
{
  "event_id": "497bb50d-41ae-4916-9ba8-de92b456fdfd",
  "full_name": "Sankalp Bhattacharjee",
  "email": "sankalp@example.com",
  "phone": "9199999999",
  "school": "Delhi Public School, Sector-45",
  "city": "Gurugram",
  "country": "India",
  "designation": "Teacher",
  "classes_taught": ["Secondary (Class 9–10)", "Senior Secondary (Class 11–12)"]
}
```

### Required Fields
| Field      | Type   | Description                          |
|------------|--------|--------------------------------------|
| event_id   | string | Supabase UUID of the event           |
| full_name  | string | Registrant's full name               |
| email      | string | Registrant's email address           |

### Optional Fields
| Field          | Type     | Description                        |
|----------------|----------|------------------------------------|
| phone          | string   | WhatsApp number (for WA message)   |
| school         | string   | School/institution name            |
| city           | string   | City                               |
| country        | string   | Country (default: India)           |
| designation    | string   | e.g. Teacher, Principal            |
| classes_taught | string[] | Array of class levels              |

---

## Response

### Success
```json
{
  "success": true,
  "registrant_id": "uuid",
  "email_sent": true,
  "whatsapp_sent": true
}
```

### Error
```json
{
  "error": "event_id is required"
}
```

---

## Getting the Event ID

1. Create an event in EDXSO Comms dashboard
2. Go to Supabase → Table Editor → events
3. Copy the `id` UUID of your event
4. Hardcode it in your website for that event's registration form

---

## Example — Node.js / Express

```javascript
app.post('/register', async (req, res) => {
  const { name, email, phone, school } = req.body;

  // After saving to your own DB...
  await fetch('https://YOUR_VERCEL_URL/api/webhook/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_WEBHOOK_SECRET'
    },
    body: JSON.stringify({
      event_id: 'YOUR_EVENT_UUID',
      full_name: name,
      email: email,
      phone: phone,
      school: school
    })
  });

  res.json({ success: true });
});
```

## Example — PHP

```php
$data = [
  'event_id'  => 'YOUR_EVENT_UUID',
  'full_name' => $_POST['name'],
  'email'     => $_POST['email'],
  'phone'     => $_POST['phone'],
  'school'    => $_POST['school'],
];

$ch = curl_init('https://YOUR_VERCEL_URL/api/webhook/register');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Content-Type: application/json',
  'Authorization: Bearer YOUR_WEBHOOK_SECRET'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
```

---

## Re-registration Handling

If the same email registers twice for the same event, the existing record is
updated (not duplicated). No duplicate confirmation is sent.

---

## Notes

- Phone numbers are automatically formatted to Indian format (+91)
- The school name is used for certificate generation
- Confirmation templates used: "Registration Confirmation - Email" and
  "Registration Confirmation - Whatsapp" from your Templates page