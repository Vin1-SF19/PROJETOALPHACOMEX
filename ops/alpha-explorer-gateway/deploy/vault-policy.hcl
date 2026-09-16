path "alpha-explorer/data/smb-bindings/*" {
  capabilities = ["create", "read", "update", "delete"]
}

path "alpha-explorer/metadata/smb-bindings/*" {
  capabilities = ["read", "delete"]
}
