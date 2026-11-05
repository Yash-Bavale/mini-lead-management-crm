# API Documentation

Base URL (local): `http://localhost:5000`

All successful responses use JSON. Errors use `{ "error": "..." }`.

## Authentication

### POST `/api/auth/login`
Public. Body:
```json
{ "email": "admin@example.com", "password": "ChangeMe123!" }
```
Returns:
```json
{ "token": "<jwt>", "admin": { "id": "...", "email": "admin@example.com" } }
```

### GET `/api/auth/me`
Requires bearer token. Returns the logged-in admin.

## Leads

### POST `/api/leads`
Public. Creates a lead.
```json
{
  "customerName": "Aarav Patil",
  "mobile": "9876543210",
  "email": "aarav@example.com",
  "service": "Product A",
  "message": "Please call after 5 PM."
}
```
The service must be `Product A`, `Product B`, `Product C`, or `Other`. A new lead receives status `New`.

### GET `/api/leads`
Admin only. Query parameters:
- `search`: matches customer name or mobile
- `service`: exact service value
- `status`: `New`, `Contacted`, `Interested`, `Converted`, `Not Interested`

Returns `{ "leads": [...] }`, newest first.

### GET `/api/leads/stats`
Admin only. Returns counts for `total`, `new`, `contacted`, and `converted`.

### GET `/api/leads/:id`
Admin only. Returns `{ "lead": {...} }`.

### PATCH `/api/leads/:id`
Admin only. Send one or both permitted fields:
```json
{ "status": "Contacted", "internalRemarks": "Called; follow up Friday." }
```
Returns the updated lead. Customer-submitted fields cannot be changed through this endpoint.

## Authorization
For admin routes, send:
`Authorization: Bearer <token>`

## Status values
`New`, `Contacted`, `Interested`, `Converted`, `Not Interested`
