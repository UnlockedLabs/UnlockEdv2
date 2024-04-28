## Plugin Architecture | Middleware Design Document

As you have both now heard the initial pitch, I will try to explain more specific examples of my thought process as to why I believe an external service would be wholly beneficial to the product.

### **Concurrent Sessions/State:**

`Kolibri`'s integration requires us to maintain an authorized session, much like we are a browser, to interact with their API. This has several challenges, as a heartbeat style `PUT` request is required consistently to maintain the session, and as we know, PHP processes are not long-lived and would require an in-memory cache.

Clearly this alone doesn't make it impossible, but as the number of concurrent providers increases, it adds significant complexity to the integration process. For instance,  we use a cron job to fetch data throughout the day, and we shard the users and make calls to fetch data every users % 24 hrs. We will be faced with the challenge of having to keep track and maintain many, many sessions (possibly _far_ more than we will even expect) as individual user and admin actions while using the platform will each trigger these calls while these jobs are going on.

`If managing N concurrent sessions is complicated in PHP, why couldn't multple KolibriServices instances just use the same cached session token?`

It's likely that for some time, they could. The problem is when another instance of the class updates the token in the cache, because it made the `PUT/POST` request that triggers the token update, this would invalidate the token for all other instances relying on it for their sessions. The fix for this would be for every instance to retrieve their XCRFToken headers before each call...  `But which class instance is now responsible for the timed, periodic heartbeat session refresh PUT requests?`

Well the solution to that would obviously be to have a singleton class that is responsible for the session, and all instances would have to call it to get the token before making a call. This would require a lot of testing to ensure that the session is maintained correctly, especially considering that it's possible that requests will need to be made from any class that will trigger a token refresh, so that the singleton class would have to be injected into every class that needs to make a call.

`Ok, so instead we have each instance create it's own session when it needs to make calls, and just give it a UUID so it can deal with updating its own session.`

This is likely the way it would have to be done, although I'm not 100% sure yet.

In production, due to some unforeseen use, we could end up using hundreds of sessions at once and trigger some kind of rate limiting or security/auth issue on the provider platform with which we are integrating. There is lots to think about here, and it's honestly not as simple as it seems especially when you factor in scale.

The `Canvas` integration requires us to maintain an `oauth` token, and although currently we are getting around it by using the test key, technically we are only allowed to fetch this data on a per-user basis, with an oauth key exchange required for each session before we can make any calls on their behalf. You can imagine that if we are eventually forced to aquire a token for each user and maintain it, the complexity of the system will increase significantly.

`How does Go fix this?`

Go's concurrency primitives would allow us to maintain one session per provider, no matter how many calls/instances of the `KolibriServices` class exist in the product, and they would never need to worry about what type of provider they are dealing with.

When a new provider is created in the product, the first time the KolibriServices class is instantiated, it will call the service with the ProviderID, and the middleware will see it's new, trigger a callback to the product that will automatically POST the necessary details to the middleware, and the middleware will initiate an authorized session with the provider.

No matter how many instances of the class call the middleware, there will only ever be one session, with one Goroutine (green-thread) responsible for maintaining it, updating the token on a timer, etc. This solves any eventual issue where we have to deal with the possibility of having hundreds of sessions, and imo reduces the complexity of that solution.

`What about the Canvas integration? One session would be needed per user`

The same logic applies, the one instance of the middleware would (is) capable of maintaining multiple sessions, and the OAuth sessions would be independent and implement the same interface.


## Concerns:

1. An additional application to consider when deploying the product:

  - This is a valid concern, but likely our eventual deployments will involve containers, and the middleware could be easily containerized and deployed alongside the product, as well as added to our `sail` configuration so it would be running locally in our development environments possibly without some even aware of it, as I will be developing/deploying it. This will remain dependency-free, relying on only the Go std-library and sqlite3.

2. A new language to learn and maintain:

  - Also a valid concern. I believe that in the long run, because I will be solo developing this for the foreseeable future, there is not going to be any rush or reason to quickly require anyone else to learn it. If I was to move on, doubtless there would need to be a new back-end dev brought-in anyway to replace me and Go is the most popular back-end language at the moment and I believe a majority of back-end developers already know it. If not, it's a language that can be learned in a matter of a few days, and is very easy to reason about. If you know any C based language, you are already 80% of the way there. Also, one of our goals is to mentor and train developers for future opportunities, and having to adapt to a new language on the job is something they will likely want to be comfortable with.

3. Introducing an additional long running process:

  - Honestly I believe for the purposes of hosting/caching content like thumbnails, videos, etc in the future, this will prove to be a benefit, and the complexity of the product will be reduced by having a separate service responsible for the compute, and the product responsible for the business logic.

4. Introducing another database (Sqlite) in the service:

  - This is not a database that would ever have migrations, or complex tables, etc. This would only be used to store the relevant information about each provider, which is automatically sent to the middleware upon first instantiation of a KolibriServices class from a newly created provider. A call is made, the provider_ID is on the query string, if no provider exists, in the middleware the constructor of the provider services class will automatically POST the necessary details to the middleware, so no thought or concern needs to be put into normalizing data between the sqlite cache and the platform.
  This prevents the need for the product to be aware of the provider's schema, and allows the middleware to handle the data normalization.

### Another benefit to Middleware layer: **Compute:** 

The `icon_url` field of the `Courses` resource in kolibri. This field is returned as base64 + `png` encoded data, instead of a URL. In a scenario where we have hundreds of courses, things like this could significant performance issues on lesser-grade hardware when we are having to make several calls in PHP to several platforms simultaneously, and deserialize all the data, store the encoded image, host it, and create a URL we can serve to the client.

You can imagine as our product grows, searching, sorting, indexing, and hosting tens of thousands of Images, Videos, PDF documents, etc. is another concern that we will have.

My proposition is to introduce a `Go` middleware/service that will not only be responsible for provider integrations, but it will also serve as a compute layer, where any heavy lifting could be offloaded to a more performant language. A multi-provider aware User importation service, that can be responsible for exporting data from many platforms, fuzzy matching them, etc, would be a good example of this. Hosting the images, PDF's, videos, and implementing document search through the files and metadata, would be another.

Clearly this doesn't entirely solve the complexity issue, as it would essentially be handing the complexity off to another service. However, in my opinion it does provide a clear separation of concerns. The product can focus on the business logic, and handling/providing MVC actions, our user authentication and authorization of clients. 

This session mgmt issue is just the first of what I expect will be other challenges as we integrate with other platforms and expand the scope of the product.

### Alternatives:

The idea of a 'Plugin' system is seemingly the most intuitive, approachable method of dealing with integrations. This would involve the same logic and compute that I am describing in the middleware, only the PHP classes that implement the Provider interface, that would be doing the same computation, would be loaded by the product, and the methods that currently exist on the KolibriServices class, would be called and expected to return the same data, without it worrying about how it was retrieved.

Now we can see that this is essentially the same idea/concept, as KolibriServices class would be called by the product to populate certain tables and make the information available to the client. The difference being that the inevitable complexity of dealing with multiple authentication sessions, providers, and the compute required to interact with them, would be abstracted away from the product, and instead be the responsibility of the middleware.

I think `Laravel` is a great framework for our current use-case, but building a system where we are loading and unloading PHP code at runtime (although that is the only time, so I guess it's all runtime lol), and having that code perform computationally-expensive, or long-lived tasks to integrate with the necessary providers feels like tasks better suited to an external service. From my understanding and inquiries, services like this are rather common, although maybe for larger companies.

A modular, traditional plugin style system would make the most sense from a development perspective, imo, if we had a platform that was large enough, with a big enough community where we would have outside, unrelated entities creating plugins for their service in our product. If we are the only ones writing these plugins, it doesn't feel too much different from a Provider trait or interface with the methods defined, and the class itself can inherit from a provider base class with the HTTP methods they can overload. Not that it's somehow a bad thing.


## Middleware API/Interface:

Currently it's outlined something like this:

`/api/<object>?id=<provider_id>` - Any call to this service will be made with the query parameter `id`. This initial call to the service, will allow the middleware to search for the provider in the database, and initiate the necessary session required to make further calls.
w/ Headers: `Authorization: <ENV_VAR token>`, which is checked by middleware to ensure only the product can make calls to the service. Obviously I have only spent a few days on this, not knowing if it will end up in the codebase so all the details could be changed/improved.

**e.g.**

*GET* `/api/users?id=<provider_id>` - Returns all User objects from the specified provider, in the expected JSON format that the provider expects.

