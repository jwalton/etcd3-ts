#!/usr/bin/env bash

PROTO_IMPORT_DIR="./proto"
GEN_OUT_DIR="./src/client"
FILE_PATHS='./proto/**/*.proto ./proto/**/**/*.proto ./proto/**/**/**/*.proto ./proto/**/**/**/**/**/*.proto'

set -e

# Create the generated output dir if it doesn't exist
rm -rf ${GEN_OUT_DIR}
if [ ! -d "$GEN_OUT_DIR" ]; then
  mkdir -p ${GEN_OUT_DIR}
fi

mkdir -p ./proto/etcd/auth/authpb
mkdir -p ./proto/etcd/mvcc/mvccpb
mkdir -p ./proto/etcd/etcdserver/api/snap/snappb
mkdir -p ./proto/etcd/etcdserver/api/v3election/v3electionpb
mkdir -p ./proto/etcd/etcdserver/api/v3lock/v3lockpb
mkdir -p ./proto/etcd/etcdserver/etcdserverpb
mkdir -p ./proto/gogoproto

cp ./etcd/auth/authpb/*.proto ./proto/etcd/auth/authpb
cp ./etcd/mvcc/mvccpb/*.proto ./proto/etcd/mvcc/mvccpb
cp ./etcd/etcdserver/api/snap/snappb/*.proto ./proto/etcd/etcdserver/api/snap/snappb
cp ./etcd/etcdserver/api/v3election/v3electionpb/*.proto ./proto/etcd/etcdserver/api/v3election/v3electionpb
cp ./etcd/etcdserver/api/v3lock/v3lockpb/*.proto ./proto/etcd/etcdserver/api/v3lock/v3lockpb
cp ./etcd/etcdserver/etcdserverpb/*.proto ./proto/etcd/etcdserver/etcdserverpb
rm ./proto/etcd/etcdserver/etcdserverpb/raft_internal.proto
cp ./etcd/vendor/github.com/gogo/protobuf/gogoproto/gogo.proto ./proto/gogoproto

echo Generate JavaScript
npm-run grpc_tools_node_protoc \
  --js_out=import_style=commonjs,binary:${GEN_OUT_DIR} \
  --grpc_out=${GEN_OUT_DIR} \
  --plugin=protoc-gen-grpc="./node_modules/.bin/grpc_tools_node_protoc_plugin" \
  -I ${PROTO_IMPORT_DIR} \
  ${FILE_PATHS}

echo Generate TypeScript definitions
npm-run grpc_tools_node_protoc \
  --plugin=protoc-gen-ts=./node_modules/.bin/protoc-gen-ts \
  --ts_out=${GEN_OUT_DIR} \
  -I ${PROTO_IMPORT_DIR} \
  ${FILE_PATHS}