# UnlockEdv2

## Requirements

Currently, UnlockEdv2 is tested on Windows (WSL), Mac (homebrew) and Ubuntu. 

- Docker (Docker Desktop on WSL)
- Php and Composer (Platform specific)

## Development

The commands below assume you have a shell alias setup in your .bashrc or .zshrc file for the sail command: `alias sail='[ -f sail ] && sh sail || sh vendor/bin/sail`. If you haven't configured that, you can substitute any call to `sail` with `./vendor/bin/sail`.

- Clone the repository
- Copy ‘.env.example’ to ‘.env’
- Run `composer install`
- Run `sail up`
- Run `sail artisan migrate`
- Run `sail npm run dev`
- Open http://localhost
- Register a user or login

## Testing

- Run `sail artisan test`

## License

UnlockEdv2 is open-sourced software licensed under the [Apache License, Version 2.0](https://opensource.org/license/apache-2-0/).
