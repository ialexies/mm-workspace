# Tour deposit — documentation index

End-to-end reference for the **Rezdy tour $100 USD deposit** feature (pay deposit now, balance on arrival).

| Document | Location |
|----------|----------|
| **Full reference** (API, amounts, Rezdy, env, deploy, troubleshooting) | [`backend/docs/TOUR_DEPOSIT.md`](../backend/docs/TOUR_DEPOSIT.md) |
| **Frontend UI & QA** (labels, amount checks, env) | [`frontend/docs/TOUR_DEPOSIT.md`](../frontend/docs/TOUR_DEPOSIT.md) |
| **Local frontend + staging API** (kubectl port-forward) | [`LOCAL_WORKSPACE.md`](../LOCAL_WORKSPACE.md#local-frontend--staging-k8s-backend-port-forward) |
| **Implementation plan** (historical) | [`.cursor/plans/tour_$100_deposit_904daed3.plan.md`](../.cursor/plans/tour_$100_deposit_904daed3.plan.md) |

---

## Amount check (tour-only)

From `GET /cart/payment-options` (or checkout UI with deposit selected):

```text
depositDue + balanceDue = totalAmount
```

Deposit is the configured rule (e.g. **$100 USD** per guest) converted to the cart currency. Stripe charges **`depositDue`**, not a fixed `10000`, when the cart is IDR/PHP/AUD/etc.

---

## Quick commands

**Local frontend → staging K8s API** (deposit checkout):

```powershell
kubectl port-forward -n staging svc/backend 18080:80
```

```env
# frontend/.env.local
NEXT_PUBLIC_V3_API_BASE=http://127.0.0.1:18080/
```

**Deploy backend** (from `backend/`, Git Bash/WSL):

```bash
./deploy.sh
DEPLOY_DOCKER_NO_CACHE=1 ./deploy.sh   # clean Docker build
```

See [`backend/docs/TOUR_DEPOSIT.md`](../backend/docs/TOUR_DEPOSIT.md) for production namespace and rollout details.
