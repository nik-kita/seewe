set unstable := true

export JSON_FILES_WITH_VERSION := 'package.json api/deno.json'

alias format := fmt
alias v := version

default:
    just --list

ls:
    just --choose

bump: _pre_bump _bump fmt

@_pre_bump:
    npm run build
    echo
    echo  This version will be used: {{ BOLD + BLUE }}$(just v){{ NORMAL }}
    echo "{{ ITALIC }}(to change - modify first line in ./VERSION.MD){{ NORMAL }}"
    echo

[confirm('Ok? (y/N)')]
[script('bash')]
_bump:
    VERSION=$(just v)
    if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
      echo "The first line of ./VERSION.MD should be valid semver version format (markdown heading allowed): $VERSION"
      exit 1
    fi
    for FILE in {{ JSON_FILES_WITH_VERSION }}; do
      jq ".version" "$FILE" && \
      jq ".version=\"$VERSION\"" "$FILE" > tmp.$$.json && mv tmp.$$.json "$FILE"
    done
    echo {{ BOLD + BLUE }}v$VERSION

[script('bash')]
version:
    head -n 1 ./VERSION.MD | awk '{               
        sub(/#*\s*v?/, "");
        sub(/\s+.*/, "");
        print
      }'

fmt:
    just --fmt --unstable
    deno fmt --unstable-component --unstable-sql
    cd api && deno fmt

[script('bash')]
gen-types:
    curl http://localhost:3000/v1/json > api_version_one.json
    npx openapi-typescript@latest ./api_version_one.json -o ./src/types/api_version_one.ts
    just fmt

[script('bash')]
brickyard-disable:
    cp src/bricks.interceptor.example.ts src/bricks.interceptor.ts
    cp api/bricks.interceptor.example.ts api/bricks.interceptor.ts

check:
    npm run type-check
    cd api && deno check mod.ts

test:
    cd api && deno task test

_dev_api:
    cd api && deno task start

_dev_ui:
    npm run dev

[script('bash')]
dev:
    trap 'kill 0' SIGINT;
    just _dev_api &
    just _dev_ui & 
    wait

install:
    npm i
    cd api && deno install --allow-scripts

build:
    npm run build

gen_jwt_keys_for_dotenv:
    deno run -A api/utils/generate_crypto_keys.cli.util.ts
