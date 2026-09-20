<?php

declare(strict_types=1);
?><!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pagamento confirmado | A Hora com o Especialista</title>

  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-7RHBD29L5S"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
    try {
      window.gtag('js', new Date());
      window.gtag('config', 'G-7RHBD29L5S', {
        send_page_view: true,
        /* A URL desta página carrega o session_id do Stripe, que vale como credencial:
           quem tem ele consegue um token em /api/get-token.php. Por isso o page_location
           é reescrito sem a query string — o Google nunca recebe o identificador. */
        page_location: window.location.origin + window.location.pathname
      });
    } catch (e) {
      console.warn('GA4 indisponível', e);
    }
  </script>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: radial-gradient(circle at top, #111827, #030712 55%);
      color: #e5e7eb;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(680px, 100%);
      background: rgba(17, 24, 39, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35);
    }
    h1 { margin-top: 0; font-size: clamp(1.5rem, 2vw, 2rem); }
    p { line-height: 1.6; }
    .status { color: #93c5fd; min-height: 24px; }
    .actions { margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      padding: 12px 18px;
      border: 0;
      cursor: pointer;
    }
    .btn-primary { background: #10b981; color: #062a21; }
    .btn-outline { background: transparent; border: 1px solid #64748b; color: #e2e8f0; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <main class="card">
    <h1>✅ Pagamento confirmado. Agora escolha o melhor horário.</h1>
    <p class="status" id="status">Confirmando pagamento...</p>

    <div class="actions hidden" id="successActions">
      <a id="scheduleLink" class="btn btn-primary" href="#">Agendar agora</a>
    </div>

    <div class="actions hidden" id="fallbackActions">
      <p style="flex-basis:100%; margin:0;">Se houve algum problema, clique abaixo.</p>
      <a class="btn btn-outline" href="/a-hora-com-o-especialista">Comprar acesso</a>
    </div>
  </main>

  <script>
    (function () {
      const statusEl = document.getElementById('status');
      const successActions = document.getElementById('successActions');
      const fallbackActions = document.getElementById('fallbackActions');
      const scheduleLink = document.getElementById('scheduleLink');

      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('session_id');
      const startedAt = Date.now();
      const timeoutMs = 60000;
      const pollIntervalMs = 3000;

      const utmParams = new URLSearchParams();
      params.forEach((value, key) => {
        if (key !== 'session_id') utmParams.append(key, value);
      });

      if (!sessionId) {
        statusEl.textContent = 'Não encontramos o identificador da sessão de pagamento.';
        fallbackActions.classList.remove('hidden');
        return;
      }

      function showFallback() {
        statusEl.textContent = 'Ainda estamos processando sua confirmação.';
        fallbackActions.classList.remove('hidden');
      }

      /* Valor espelhado de api/create-checkout-session.php (unit_amount 99700).
         Se o preço mudar lá, mudar aqui também. */
      const PURCHASE_VALUE_BRL = 997;
      const PURCHASE_GUARD_KEY = 'purchase_tracked_' + sessionId;
      let purchaseSent = false;

      /* O session_id é credencial e não pode ir para o Google. O hash dá ao GA4 um
         transaction_id estável para deduplicar a compra, sem ser reversível. */
      async function hashedTransactionId() {
        try {
          if (!window.crypto || !window.crypto.subtle) return null;
          const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessionId));
          return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
        } catch (error) {
          return null;
        }
      }

      async function trackPurchase() {
        if (purchaseSent || typeof window.gtag !== 'function') return;
        try {
          if (localStorage.getItem(PURCHASE_GUARD_KEY)) return;
        } catch (error) {
          /* localStorage bloqueado: segue sem a guarda entre recarregamentos */
        }
        purchaseSent = true;

        const payload = {
          currency: 'BRL',
          value: PURCHASE_VALUE_BRL,
          items: [{ item_name: 'A Hora com o Especialista', price: PURCHASE_VALUE_BRL, quantity: 1 }]
        };
        const transactionId = await hashedTransactionId();
        if (transactionId) payload.transaction_id = transactionId;

        window.gtag('event', 'purchase', payload);

        try {
          localStorage.setItem(PURCHASE_GUARD_KEY, '1');
        } catch (error) {
          /* sem localStorage a compra ainda foi contada nesta visita */
        }
      }

      function applyToken(token) {
        const redirectParams = new URLSearchParams(utmParams);
        redirectParams.set('t', token);
        scheduleLink.href = '/agendar?' + redirectParams.toString();
        statusEl.textContent = 'Tudo certo! Seu acesso foi liberado.';
        successActions.classList.remove('hidden');
        trackPurchase();
      }

      async function pollToken() {
        try {
          const response = await fetch('/api/get-token.php?session_id=' + encodeURIComponent(sessionId), {
            headers: { 'Accept': 'application/json' }
          });
          if (!response.ok) throw new Error('HTTP ' + response.status);

          const data = await response.json();
          if (data && data.token) {
            applyToken(data.token);
            return;
          }
        } catch (error) {
          console.warn('Falha ao consultar token', error);
        }

        if (Date.now() - startedAt >= timeoutMs) {
          showFallback();
          return;
        }

        setTimeout(pollToken, pollIntervalMs);
      }

      pollToken();
    })();
  </script>
</body>
</html>
