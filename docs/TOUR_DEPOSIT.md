# Tour deposit — documentation index

End-to-end reference for the **Rezdy tour $100 USD deposit** feature (pay deposit now, balance on arrival).

| Document | Location |
|----------|----------|
| **Full reference** (API, Rezdy, env, troubleshooting, deployment) | [`backend/docs/TOUR_DEPOSIT.md`](../backend/docs/TOUR_DEPOSIT.md) |
| **Local frontend + staging API** (kubectl port-forward) | [`LOCAL_WORKSPACE.md`](../LOCAL_WORKSPACE.md#local-frontend--staging-k8s-backend-port-forward) |
| **Implementation plan** (historical) | [`.cursor/plans/tour_$100_deposit_904daed3.plan.md`](../.cursor/plans/tour_$100_deposit_904daed3.plan.md) |

**Quick command** when local Next.js must hit staging K8s backend (deposit checkout):

```powershell
kubectl port-forward -n staging svc/backend 18080:80
```

```env
# frontend/.env.local
NEXT_PUBLIC_V3_API_BASE=http://127.0.0.1:18080/
```
