## Provider Platform Middleware

This middleware is intended to run as a service in the same cluster, connected to the same database as an instance of UnlockEdv2.
It will handy the resource intensive business of fetching, parsing, deduping data from platform integrations, and eventually will run
scheduled jobs for these tasks which it will pull off a queue.

### **API**

_GET_ `/api/users?id=<provider_id>` - Returns all User objects from the specified provider, in the expected JSON format that the provider expects.

Some calls may do the database writes in the middleware, as returning the json to the backend is expensive and rarely necessary.
Currently only the GetUsers method will return the json, for the client to map user accounts between product and platform.

The middleware will never be exposed to the outside internet, so it can use the `/api` URI prefix (nginx won't forward client requests to it).

`/api/<object>?id=<provider_id>` - Any call to this service will be made with the query parameter `id`. This initial call to the service, will allow the middleware to search for the provider in the database, and initiate the necessary session required to make further calls.

Headers: `Authorization: <ENV_VAR token>`, just to ensure only the product can make calls to the service.

Some providers do not provide public API's for us to consume their content, in which case we are forced to login and get a session each time
we make a call to the specific provider.

A ProviderService class exists in the backend to communicate with the middleware from the platform. You can call the methods directly on
this class, or it has a `Request` method that accepts a URL, to handle adding the relevant data to the request, for when you wish to add more
Provider calls.

From the handlers, given a provider platform:

```go
provider, err :=  Db.Conn.GetProviderPlatformByID(id)
service := src.GetProviderService(&provider)

service.GetUsers()
// or
service.GetActivityForProgram(programId)
```

When implementing a new provider platform for the middleware, you can add a Method to the Go interface in the `provider-middleware/main.go` file

```go
type ProviderServiceInterface interface {
 GetUsers(db *gorm.DB) ([]models.ImportUser, error)
 ImportPrograms(db *gorm.DB) error
 ImportMilestonesForProgramUser(courseId, userId uint, db *gorm.DB) error
 ImportActivityForProgram(courseId string, db *gorm.DB) error
}
// and then define a concrete implementation of the interface in the `{provider_name}.go` file.
```

typically they will need the database connection along with any relevant information needed to make the calls.
The concrete implementation of each ProviderServiceInterface should always store the info needed to communicate with the Provider,
and have helper methods that can be called to make requests, convert data types, etc.

When the provider middleware gets a request, it looks up the provider id in the database, and depending on the Type of provider,
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
  if err := kolibriService.InitiateSession(); err != nil {
   log.Printf("Failed to initiate session: %v", err)
   return nil, fmt.Errorf("failed to initiate session: %v", err)
  }
  return kolibriService, nil
 case models.CanvasCloud, models.CanvasOSS:
  canvasService := newCanvasService(provider)
  return canvasService, nil
 }
 return nil, fmt.Errorf("unsupported provider type: %s", provider.Type)
}
```
