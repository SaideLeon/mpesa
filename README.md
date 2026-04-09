# 💚 M-Pesa Integration — Next.js (App Router)

Integração completa do M-Pesa Moçambique para aplicações Next.js com TypeScript.

---

## 📁 Estrutura dos Ficheiros

Copia os ficheiros para o teu projecto Next.js desta forma:

```
teu-projecto/
├── lib/
│   └── mpesa.ts                          ← Serviço principal (lógica M-Pesa)
├── hooks/
│   └── useMpesaPayment.ts                ← Hook React para o frontend
├── components/
│   └── MpesaPaymentForm.tsx              ← Componente de exemplo
├── app/
│   └── api/
│       └── payments/
│           └── mpesa/
│               ├── initiate/
│               │   └── route.ts          ← POST: Inicia pagamento C2B
│               ├── status/
│               │   └── route.ts          ← GET:  Verifica status
│               └── webhook/
│                   └── route.ts          ← POST: Recebe callbacks
└── .env.local                            ← As tuas credenciais (não commitar!)
```

---

## 🚀 Instalação

### 1. Copia os ficheiros para o teu projecto

### 2. Configura as variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Edita `.env.local` com as tuas credenciais do M-Pesa Developer Portal.

### 3. Obtém as credenciais

1. Vai a [developer.mpesa.vm.co.mz](https://developer.mpesa.vm.co.mz)
2. Cria uma conta e faz login
3. Cria uma nova aplicação
4. Copia a **API Key** e o **Public Key**
5. Anota o teu **Service Provider Code**

---

## 📡 Endpoints da API

### `POST /api/payments/mpesa/initiate`

Inicia um pagamento C2B. O cliente recebe notificação no telemóvel.

**Body:**
```json
{
  "amount": 150.00,
  "phone": "840000000",
  "orderId": "ORDER-123"
}
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Pedido de pagamento enviado. O cliente deve confirmar no telemóvel.",
  "transactionId": "wdv2x712xjsx",
  "conversationId": "abc123",
  "transactionReference": "PAY-LB5K2-XC7R"
}
```

---

### `GET /api/payments/mpesa/status?transactionId=...&orderId=...`

Verifica o estado de uma transacção.

**Resposta:**
```json
{
  "success": true,
  "status": "COMPLETED",
  "code": "INS-0",
  "description": "Pedido processado com sucesso",
  "transactionId": "wdv2x712xjsx"
}
```

---

### `POST /api/payments/mpesa/webhook`

Recebe notificações automáticas do M-Pesa quando um pagamento é confirmado ou rejeitado.

> ⚠️ **Regista este URL no M-Pesa Developer Portal** como "Callback URL"

---

## 💻 Uso no Frontend

### Com o Hook (recomendado)

```tsx
import { useMpesaPayment } from "@/hooks/useMpesaPayment";

export function CheckoutPage() {
  const { pay, status, error, isWaiting } = useMpesaPayment({
    onSuccess: (result) => {
      // Redireciona para página de sucesso
      router.push(`/orders/${orderId}/success`);
    },
  });

  return (
    <button onClick={() => pay({ amount: 500, phone: "840000000", orderId: "ORD-1" })}>
      Pagar 500 MZN
    </button>
  );
}
```

### Chamada directa à API

```typescript
const response = await fetch("/api/payments/mpesa/initiate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    amount: 500,
    phone: "840000000",
    orderId: "ORDER-123",
  }),
});

const data = await response.json();
```

---

## 🧪 Testar em Sandbox

1. Define `MPESA_ENVIRONMENT=sandbox` no `.env.local`
2. Usa o número de teste: `258840000000`
3. Usa o código de serviço de teste: `171717`
4. O sandbox não envia notificação real — usa o endpoint de status para verificar

---

## 🌐 Webhook em Desenvolvimento Local

Para receber callbacks do M-Pesa localmente:

```bash
# Instala ngrok
npm install -g ngrok

# Expõe o teu servidor local
npx ngrok http 3000

# Usa o URL gerado no portal M-Pesa:
# https://xxxx.ngrok.io/api/payments/mpesa/webhook
```

---

## 📋 Códigos de Resposta M-Pesa

| Código   | Descrição                              |
|----------|----------------------------------------|
| INS-0    | ✅ Processado com sucesso              |
| INS-5    | ❌ Saldo insuficiente                  |
| INS-9    | ❌ Transacção duplicada                |
| INS-13   | ❌ Utilizador inválido                 |
| INS-15   | ❌ Valor inválido                      |
| INS-18   | ❌ MSISDN inválido                     |
| INS-995  | ❌ Pedido cancelado pelo utilizador    |
| INS-996  | ⏳ Utilizador não respondeu           |
| INS-998  | ❌ Transacção não completada          |

---

## 🔒 Boas Práticas de Segurança

- **Nunca** exponhas as tuas credenciais no código cliente (apenas Server Components / API Routes)
- Adiciona `.env.local` ao `.gitignore`
- Valida sempre o payload do webhook antes de processar
- Armazena o `transactionId` na tua base de dados para reconciliação
- Em produção, verifica a origem dos pedidos ao webhook

---

## 📞 Suporte

- Portal Developer: [developer.mpesa.vm.co.mz](https://developer.mpesa.vm.co.mz)
- Comunidade MozDevz: [mozdevz.github.io/opensource](https://mozdevz.github.io/opensource/)
