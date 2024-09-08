## Provider Platform Middleware

This middleware is intended to run as a service in the same cluster, connected to the same database as an instance of UnlockEdv2,
which in some cases (like `kolibri`) will also contain the database of one or more provider platforms.
It will handle the resource intensive business of fetching, parsing, de-duping data from platform integrations, and either
return the data to the backend or write it to the database. The middleware is subscribed to a NATS message queue, listening for
msg's published from the `cron-tasks` service, which will trigger the middleware to fetch data from the provider platforms.

### **HTTP API**

Example:

_GET_ `/api/users?id=<provider_id>`

- Returns all User objects from the specified provider, in the expected JSON format that the provider expects.

Currently only the GetUsers method will return the json, for the client to map user accounts between product and platform.

The middleware will never be exposed to the outside internet, so it can use the `/api` URI prefix (just meaning nginx won't forward requests to the backend as it typically would because clients never make requests directly).

`/api/<object>?id=<provider_id>` - Any call to this service will be made with the query parameter `id`. This initial call to the service, will allow the middleware to search for the provider in the database, and initiate the necessary session required to make further calls.

Headers: `Authorization: <ENV_VAR token>`, just to ensure only the product can make calls to the service.

Some providers do not provide public API's for us to consume their content, in which case we are forced to login and get a session each time
we make a call to the specific provider.

A ProviderService class exists in the backend to communicate with the middleware from the platform. You can call the methods directly on
this class, or it has a `Request` method that accepts a URL, to handle adding the relevant data to the request, for when you wish to add more
Provider calls.

From the handlers, given a provider platform:

```go
provider, err :=  Db.GetProviderPlatformByID(id)
service := src.GetProviderService(&provider)

service.GetUsers()
// or
service.GetActivityForProgram(programId)
```

# New Provider Implementation

When implementing an integration for a new provider platform:

1. Create a new `.go` file for the provider in the `provider-middleware` directory.

2. Define a struct that will store the relevant provider information needed to communicate with the provider via the necessary
   API calls, or database queries. Additionally, each provider service struct needs to have a field that stores the relevant parameters
   sent by the job runner to the middleware with the necessary context to make the calls.

```go
type NewProviderService struct {
  ProviderId  uint
  ApiToken    string
  BaseURL     string
  Db      *gorm.DB
  JobParams   map[string]interface{}
}
```

3. Implement the `ProviderServiceInterface` methods found in the `main.go` on your new struct.

```go
type ProviderServiceInterface interface {
 GetUsers(db *gorm.DB) ([]models.ImportUser, error)
 ImportPrograms(db *gorm.DB) error
 ImportMilestonesForProgramUser(courseId, userId uint, db *gorm.DB) error
 ImportActivityForProgram(courseId string, db *gorm.DB) error
 GetJobParams() *map[string]interface{}
}

/*

   The job params should be stored on an instance when the service is initialized via the nats.Msg
   handler and then can be accessed via the GetJobParams method when needed. A *map[string]interface{}
   needs to be dereferenced to access the data.

   ALL params MUST include the `provider_platform_id`, `job_id` and `last_run` fields.

*/

params := *service.GetJobParams()
programs := params["programs"].([]interface{})

for _, program := range programs {
  // now we can cast it to our type
  prog := program.(map[string]interface{})
  id, externalId := prog["id"].(int), prog["external_id"].(string)
  // now we can call the necessary methods on the service
 if err := service.ImportSomethingFromProvider(id, externalId); err != nil {
    log.Error("Error importing from provider: ", err)
    sh.cleanupJob(providerID, jobId, false)
  }
}


// After each task is complete, or if an error occurs, the service should run:
service.cleanupJob(providerID, jobId, true)
// this will update the job status in the database
```

````

Additionally, you may want to define some helper methods that handle conversion of the types received from external calls, into the types we require.
It's recommended that you create a `{x_provider}_data.go` along with your `{x_provider}.go` file to define all the relevant data types and helper methods,
as to keep the concrete implementation of the provider service clean and easy to read.


When the provider middleware gets a request or pulls a publication, it looks up the provider id in the database, and depending on the `Type` of provider,
it instantiates a new instance of the concrete type and returns it so the methods defined in the interface can be called.


```go
func (sh *ServiceHandler) initService(r *http.Request) (ProviderServiceInterface, error) {
 id, err := strconv.Atoi(r.URL.Query().Get("id"))
 if err != nil {
  log.Error("GET Provider handler Error: ", err.Error())
  return nil, err
 }
 provider, err := sh.LookupProvider(id)
 if err != nil {
  log.Printf("Error: %v", err)
  return nil, fmt.Errorf("failed to find provider: %v", err)
 }
 switch provider.Type {
  case models.Kolibri:
  kolibriService := NewKolibriService(provider)
  return kolibriService, nil
 case models.CanvasCloud, models.CanvasOSS:
  canvasService := newCanvasService(provider)
  return canvasService, nil
 }
 return nil, fmt.Errorf("unsupported provider type: %s", provider.Type)
}
````

The published tasks should be sent with a `last_run` field, which will be used to determine the date range for the data to be requested from the provider.
Any other additional data needed for the requests should be sent in the `Data` field of the published message (referenced as `params` or `JobParams`)

```go
body := map[string]interface{}{
  "provider_platform_id": 1,
  "last_run": "2024-03-02",
  "programs": []map[string]interface{}{
    map[string]interface{}{
    "id": 2,
    "external_id": "1234",
    },
    map[string]interface{}{
    "id": 3,
    "external_id": "5678",
    },
  },
}
bytes, err := json.Marshal(&body)
msg := nats.NewMsg("tasks.some_task")
msg.Data = bytes

runner.nats.PublishMsg(msg)
```

`NATS Jetstream` is additionally used as a persistent KV store by the backend to cache data from the middleware (currently the provider users).
This means that the middleware can also expand to cache user data between relevant calls, such as JSON received from provider platforms which can
often contain more relevant data than what is needed for the particular call, so a provider implementation should be evaluated to determine if
this may be necessary. Other than in specific cases, cached data should only be valid for a 24 hour period, as the data may change on the provider's end
and we are making these calls daily.
