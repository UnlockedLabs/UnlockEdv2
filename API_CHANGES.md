## Current status of the new API 


### Routes:

LOGIN: `/api/login`

LOGOUT: `/api/logout`

RESET_PASSWORD: `/api/reset-password`


USERS:
    `GET|POST|PATCH|DELETE   /api/users`
USER_ACTIVITY_MIDDLEWARE: middleware

`/api/users/{id}/activity`
Creating a new user, returns:
```json
{
  user: {user_object...},
  temp_password: "some temp password"
}
```

LEFT_MENU:
    `GET|PUT  /api/left-menu`


PROGRAMS:
    `GET|POST|PATCH|DELETE   /api/programs`


MILESTONES:
    `GET|POST|PATCH|DELETE   /api/milestones`

THUMBNAILS: `GET   /api/photos/{contentID}`

UPLOAD_THUMBNAILS: `POST  /api/upload`
