#!/bin/sh
set -eu

npx prisma migrate deploy

npm start
