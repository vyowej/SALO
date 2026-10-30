# Business API Contract

The authoritative Business API contract, permission matrix, request/response route registry, frontend page list, and scheduler requirements now live in [BUSINESS_SIDE.md](./BUSINESS_SIDE.md).

This file previously documented `/api/v1/business/...`, obsolete roles such as `cashier` and `kitchen`, and static in-memory response shapes. Those conflict with the approved plan and are intentionally retired; do not implement or extend that contract.

The approved routes are restaurant-scoped under `/api/v1/restaurants/{restaurant}/...`, with application routes outside that scope only until a restaurant exists. See [BUSINESS_SIDE.md](./BUSINESS_SIDE.md) and the approved [business-side.md](./business-side.md).
