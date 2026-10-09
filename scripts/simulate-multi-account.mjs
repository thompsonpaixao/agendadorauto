/**
 * Pre-scale Multi-Account Simulation Test
 * 
 * Tests the concurrency model, claim logic, and scheduler behavior
 * under multi-account scenarios (10 accounts, 50 accounts, container polling, and overdue posts).
 */

class MockSchedulerEngine {
  constructor(options = {}) {
    this.globalConcurrency = options.globalConcurrency || 4;
    this.batchSize = options.batchSize || 20;
    this.lockDurationMinutes = options.lockDurationMinutes || 5;
    this.posts = [];
    this.currentTime = new Date("2026-10-02T12:00:00.000Z");
    this.executionLog = [];
    this.activeWorkersPerAccount = new Map();
    this.maxActiveWorkersPerAccount = new Map();
    this.currentGlobalWorkers = 0;
    this.maxGlobalWorkersObserved = 0;
  }

  addPost(post) {
    this.posts.push({
      id: post.id,
      accountId: post.accountId,
      accountUsername: post.accountUsername || post.accountId,
      status: post.status || "scheduled",
      scheduledAt: new Date(post.scheduledAt),
      metaContainerId: post.metaContainerId || null,
      lockedAt: post.lockedAt ? new Date(post.lockedAt) : null,
      lockedBy: post.lockedBy || null,
      nextRetryAt: post.nextRetryAt ? new Date(post.nextRetryAt) : null,
      publishAttempts: post.publishAttempts || 0,
      processingDurationMs: post.processingDurationMs || 800,
      metaProcessingState: post.metaProcessingState || null, // 'IN_PROGRESS' | 'FINISHED'
    });
  }

  advanceTimeSeconds(seconds) {
    this.currentTime = new Date(this.currentTime.getTime() + seconds * 1000);
  }

  // Exact reproduction of claim_scheduled_posts RPC logic
  claimScheduledPosts(workerId) {
    const v_now = this.currentTime;
    const lockExpiry = new Date(v_now.getTime() - this.lockDurationMinutes * 60 * 1000);

    // 1. Identify busy accounts (account has active processing post with valid lock or in 5-min retry wait)
    const busyAccounts = new Set();
    for (const p of this.posts) {
      if (
        p.status === "processing" &&
        p.lockedAt &&
        p.lockedAt >= lockExpiry
      ) {
        busyAccounts.add(p.accountId);
      }
      if (
        p.status === "processing" &&
        p.nextRetryAt &&
        p.nextRetryAt > v_now
      ) {
        busyAccounts.add(p.accountId);
      }
    }

    // 2. Category A: Active container status checks (Priority 1)
    const candidateA = [];
    const containerAccountsSeen = new Set();
    for (const p of this.posts) {
      if (
        p.status === "processing" &&
        p.metaContainerId &&
        (!p.nextRetryAt || p.nextRetryAt <= v_now) &&
        (!p.lockedAt || p.lockedAt < lockExpiry || p.lockedBy === workerId)
      ) {
        if (!containerAccountsSeen.has(p.accountId)) {
          containerAccountsSeen.add(p.accountId);
          candidateA.push({ post: p, priority: 1 });
        }
      }
    }

    // 3. Category B: New scheduled posts due for publication (Priority 2, fair: oldest 1 post per free account)
    const dueByAccount = new Map();
    for (const p of this.posts) {
      if (p.status === "scheduled" && p.scheduledAt <= v_now && !busyAccounts.has(p.accountId)) {
        if (!dueByAccount.has(p.accountId)) {
          dueByAccount.set(p.accountId, []);
        }
        dueByAccount.get(p.accountId).push(p);
      }
    }

    const candidateB = [];
    for (const [accId, postsList] of dueByAccount.entries()) {
      // Pick oldest post for this account
      postsList.sort((a, b) => a.scheduledAt - b.scheduledAt);
      candidateB.push({ post: postsList[0], priority: 2 });
    }

    // 4. Category C: Stuck processing recovery (Priority 3)
    const candidateC = [];
    for (const p of this.posts) {
      if (
        p.status === "processing" &&
        !p.metaContainerId &&
        (!p.lockedAt || p.lockedAt < lockExpiry)
      ) {
        candidateC.push({ post: p, priority: 3 });
      }
    }

    // Combine and order by priority ASC, scheduledAt ASC, limit batchSize
    const allCandidates = [...candidateA, ...candidateB, ...candidateC];
    allCandidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.post.scheduledAt - b.post.scheduledAt;
    });

    const claimed = [];
    const accountsClaimedInBatch = new Set();

    for (const cand of allCandidates) {
      if (claimed.length >= this.batchSize) break;
      if (accountsClaimedInBatch.has(cand.post.accountId)) continue;

      accountsClaimedInBatch.add(cand.post.accountId);
      cand.post.status = "processing";
      cand.post.lockedAt = new Date(v_now);
      cand.post.lockedBy = workerId;
      claimed.push(cand.post);
    }

    return claimed;
  }

  // Exact reproduction of runWithConcurrencyLimit pool
  async runWithConcurrencyLimit(items, limit, fn) {
    const results = [];
    let currentIndex = 0;

    const runWorker = async () => {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        const item = items[index];

        // Track per-account and global concurrency
        this.currentGlobalWorkers++;
        if (this.currentGlobalWorkers > this.maxGlobalWorkersObserved) {
          this.maxGlobalWorkersObserved = this.currentGlobalWorkers;
        }

        const currentAccWorkers = (this.activeWorkersPerAccount.get(item.accountId) || 0) + 1;
        this.activeWorkersPerAccount.set(item.accountId, currentAccWorkers);
        const maxAccWorkers = Math.max(
          this.maxActiveWorkersPerAccount.get(item.accountId) || 0,
          currentAccWorkers
        );
        this.maxActiveWorkersPerAccount.set(item.accountId, maxAccWorkers);

        try {
          const res = await fn(item);
          results[index] = res;
        } finally {
          this.currentGlobalWorkers--;
          const remainingAccWorkers = (this.activeWorkersPerAccount.get(item.accountId) || 1) - 1;
          this.activeWorkersPerAccount.set(item.accountId, remainingAccWorkers);
        }
      }
    };

    const workerCount = Math.min(items.length, limit);
    const workers = Array.from({ length: workerCount }, () => runWorker());
    await Promise.all(workers);
    return results;
  }

  // Simulates 1 tick of the scheduler route
  async runTick(workerId) {
    const claimed = this.claimScheduledPosts(workerId);
    if (claimed.length === 0) {
      return { claimedCount: 0, published: 0, waitingMeta: 0 };
    }

    let publishedCount = 0;
    let waitingMetaCount = 0;

    await this.runWithConcurrencyLimit(claimed, this.globalConcurrency, async (post) => {
      // Simulate execution time
      await new Promise((r) => setTimeout(r, Math.min(20, post.processingDurationMs / 20)));

      if (post.metaContainerId) {
        // Checking existing container
        if (post.metaProcessingState === "IN_PROGRESS") {
          // Still in progress
          post.status = "processing";
          waitingMetaCount++;
        } else {
          // Finished
          post.status = "published";
          post.metaContainerId = null;
          post.lockedAt = null;
          post.lockedBy = null;
          publishedCount++;
        }
      } else {
        // New post publication
        if (post.metaProcessingState === "IN_PROGRESS") {
          // Container created but needs encoding
          post.status = "processing";
          post.metaContainerId = `container_${post.id}`;
          waitingMetaCount++;
        } else {
          // Published immediately
          post.status = "published";
          post.lockedAt = null;
          post.lockedBy = null;
          publishedCount++;
        }
      }

      this.executionLog.push({
        time: new Date(this.currentTime),
        postId: post.id,
        accountId: post.accountId,
        status: post.status,
      });
    });

    return {
      claimedCount: claimed.length,
      published: publishedCount,
      waitingMeta: waitingMetaCount,
    };
  }
}

// ==========================================
// TEST SUITE
// ==========================================

async function runTestSuite() {
  console.log("=================================================");
  console.log("INICIANDO AUDITORIA DE SIMULAÇÃO MULTI-CONTA");
  console.log("=================================================\n");

  let passedAll = true;

  // ----------------------------------------------------------------
  // CENÁRIO 1: 10 contas com horários próximos (disparo às 12:00)
  // ----------------------------------------------------------------
  console.log("--- CENÁRIO 1: 10 Contas com disparo às 12:00 ---");
  const engine1 = new MockSchedulerEngine({ globalConcurrency: 4, batchSize: 20 });

  for (let i = 1; i <= 10; i++) {
    const accId = `acc_${i}`;
    // 5 posts por conta
    engine1.addPost({ id: `post_${accId}_09`, accountId: accId, scheduledAt: "2026-10-02T09:00:00Z", status: "published" });
    engine1.addPost({ id: `post_${accId}_12`, accountId: accId, scheduledAt: "2026-10-02T12:00:00Z", status: "scheduled" });
    engine1.addPost({ id: `post_${accId}_15`, accountId: accId, scheduledAt: "2026-10-02T15:00:00Z", status: "scheduled" });
    engine1.addPost({ id: `post_${accId}_18`, accountId: accId, scheduledAt: "2026-10-02T18:00:00Z", status: "scheduled" });
    engine1.addPost({ id: `post_${accId}_20`, accountId: accId, scheduledAt: "2026-10-02T20:00:00Z", status: "scheduled" });
  }

  const tick1Result = await engine1.runTick("worker-1");
  console.log(`Tick 1 (12:00): Claimed=${tick1Result.claimedCount}, Published=${tick1Result.published}`);

  // Validações Cenário 1
  const maxPerAcc = Math.max(...Array.from(engine1.maxActiveWorkersPerAccount.values()));
  const maxGlobal = engine1.maxGlobalWorkersObserved;

  console.log(`-> Concorrência Máxima por Conta: ${maxPerAcc} (Esperado: 1)`);
  console.log(`-> Concorrência Máxima Global: ${maxGlobal} (Esperado: <= 4)`);

  if (tick1Result.claimedCount === 10 && tick1Result.published === 10 && maxPerAcc === 1 && maxGlobal <= 4) {
    console.log("✅ CENÁRIO 1 PASSOU: Todos os 10 posts foram reivindicados com justiça (1 por conta), respeitando o pool global de 4.");
  } else {
    console.error("❌ CENÁRIO 1 FALHOU!");
    passedAll = false;
  }
  console.log();

  // ----------------------------------------------------------------
  // CENÁRIO 2: 50 contas simultâneas (Drenagem de Backlog em Batches)
  // ----------------------------------------------------------------
  console.log("--- CENÁRIO 2: 50 Contas com disparo às 12:00 ---");
  const engine2 = new MockSchedulerEngine({ globalConcurrency: 4, batchSize: 20 });

  for (let i = 1; i <= 50; i++) {
    const accId = `acc_${i}`;
    engine2.addPost({ id: `post_${accId}_12`, accountId: accId, scheduledAt: "2026-10-02T12:00:00Z", status: "scheduled" });
  }

  // Minuto 1 (Cron tick 1)
  const c2Tick1 = await engine2.runTick("worker-1");
  console.log(`Tick 1 (12:00): Claimed=${c2Tick1.claimedCount}, Published=${c2Tick1.published}`);

  // Minuto 2 (Cron tick 2)
  engine2.advanceTimeSeconds(60);
  const c2Tick2 = await engine2.runTick("worker-2");
  console.log(`Tick 2 (12:01): Claimed=${c2Tick2.claimedCount}, Published=${c2Tick2.published}`);

  // Minuto 3 (Cron tick 3)
  engine2.advanceTimeSeconds(60);
  const c2Tick3 = await engine2.runTick("worker-3");
  console.log(`Tick 3 (12:02): Claimed=${c2Tick3.claimedCount}, Published=${c2Tick3.published}`);

  const totalPublishedC2 = c2Tick1.published + c2Tick2.published + c2Tick3.published;
  console.log(`-> Total Publicado em 3 minutos: ${totalPublishedC2} de 50`);

  const maxPerAccC2 = Math.max(...Array.from(engine2.maxActiveWorkersPerAccount.values()));
  const maxGlobalC2 = engine2.maxGlobalWorkersObserved;

  if (c2Tick1.claimedCount === 20 && c2Tick2.claimedCount === 20 && c2Tick3.claimedCount === 10 && totalPublishedC2 === 50 && maxPerAccC2 === 1 && maxGlobalC2 <= 4) {
    console.log("✅ CENÁRIO 2 PASSOU: 50 contas drenadas perfeitamente em 3 ciclos de 1 minuto sem exceder limites.");
  } else {
    console.error("❌ CENÁRIO 2 FALHOU!");
    passedAll = false;
  }
  console.log();

  // ----------------------------------------------------------------
  // CENÁRIO 3: Container IN_PROGRESS não bloqueia outras contas
  // ----------------------------------------------------------------
  console.log("--- CENÁRIO 3: Container em processamento na Meta (Não bloqueante) ---");
  const engine3 = new MockSchedulerEngine({ globalConcurrency: 4, batchSize: 20 });

  // Conta 1 já tem container em processamento na Meta
  engine3.addPost({
    id: "post_acc1_container",
    accountId: "acc_1",
    scheduledAt: "2026-10-02T11:58:00Z",
    status: "processing",
    metaContainerId: "meta_container_123",
    metaProcessingState: "IN_PROGRESS",
    processingDurationMs: 200,
  });

  // Contas 2, 3, 4 têm posts agendados para 12:00
  for (let i = 2; i <= 5; i++) {
    engine3.addPost({
      id: `post_acc${i}_12`,
      accountId: `acc_${i}`,
      scheduledAt: "2026-10-02T12:00:00Z",
      status: "scheduled",
      processingDurationMs: 800,
    });
  }

  const c3Tick1 = await engine3.runTick("worker-1");
  console.log(`Tick 1: Claimed=${c3Tick1.claimedCount}, Published=${c3Tick1.published}, WaitingMeta=${c3Tick1.waitingMeta}`);

  // Validação: Conta 1 permaneceu em processing (waiting meta), mas Contas 2, 3, 4, 5 foram todas publicadas normalmente
  const acc1Post = engine3.posts.find((p) => p.id === "post_acc1_container");
  const publishedOthers = engine3.posts.filter((p) => p.status === "published").length;

  if (c3Tick1.waitingMeta === 1 && publishedOthers === 4 && acc1Post.status === "processing") {
    console.log("✅ CENÁRIO 3 PASSOU: Container IN_PROGRESS foi verificado rapidamente e NÃO bloqueou a publicação de outras contas.");
  } else {
    console.error("❌ CENÁRIO 3 FALHOU!");
    passedAll = false;
  }
  console.log();

  // ----------------------------------------------------------------
  // CENÁRIO 4: Posts Atrasados Continuam Elegíveis
  // ----------------------------------------------------------------
  console.log("--- CENÁRIO 4: Posts com horário anterior continuam elegíveis ---");
  const engine4 = new MockSchedulerEngine({ globalConcurrency: 4, batchSize: 20 });

  // Post agendado para 10:00 que atrasou
  engine4.addPost({
    id: "post_delayed_10",
    accountId: "acc_delayed",
    scheduledAt: "2026-10-02T10:00:00Z",
    status: "scheduled",
  });

  // Post agendado para 12:00 da mesma conta
  engine4.addPost({
    id: "post_future_12",
    accountId: "acc_delayed",
    scheduledAt: "2026-10-02T12:00:00Z",
    status: "scheduled",
  });

  const c4Tick1 = await engine4.runTick("worker-1");
  const delayedPost = engine4.posts.find((p) => p.id === "post_delayed_10");
  const futurePost = engine4.posts.find((p) => p.id === "post_future_12");

  if (c4Tick1.claimedCount === 1 && delayedPost.status === "published" && futurePost.status === "scheduled") {
    console.log("✅ CENÁRIO 4 PASSOU: Post atrasado (10:00) teve prioridade sobre o post posterior (12:00) e foi publicado.");
  } else {
    console.error("❌ CENÁRIO 4 FALHOU!");
    passedAll = false;
  }
  console.log();

  // RESUMO FINAL
  console.log("=================================================");
  if (passedAll) {
    console.log("🎉 TODOS OS TESTES DE PRÉ-ESCALA FORAM APROVADOS COM SUCESSO!");
  } else {
    console.log("❌ ALGUNS TESTES FALHARAM. VERIFIQUE OS LOGS.");
  }
  console.log("=================================================");

  process.exit(passedAll ? 0 : 1);
}

runTestSuite().catch((err) => {
  console.error("Erro fatal na simulação:", err);
  process.exit(1);
});
