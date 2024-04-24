## Plan to rewrite it in Go:


### 1. Features/endpoints to be implemented for feature parity with previous product:

1. User mgmt: /api/v1/users

2. Session -> JWT: /login, /logout

3. Auth OIDC: Canvas auth | Kolibri OIDC login TODO

4. New structure around Programs | Milestones | Outcomes | Content | User Mappings

5. Provider platforms /api/v1/provider-platforms

6. Category /api/v1/categories | Left-Menu mgmt

7. ProviderUserMapping | api/v1/users + api/v1/users/{id}/logins

8. UserActivity | api/v1/users/{id}/activity   |

9. UserActivityMap | api/v1/users/{id}/activity-map



**User Roles** | middleware/route protection


## UI integration:

Add NextJS for Routing/Views | Testing Frontend

Separation of concerns: Backend JSON API | Frontend React + NextJS for  UI-'backend'
