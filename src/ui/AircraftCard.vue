<script setup>
defineProps({ presentation: { type: Object, required: true } });
</script>

<template>
  <article class="gev-aircraft-card">
    <p v-if="presentation.subtitle" class="gev-aircraft-subtitle">
      {{ presentation.subtitle }}
    </p>
    <dl class="gev-aircraft-identity">
      <div v-for="row in presentation.identity" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
    <p v-if="presentation.emergency" class="gev-aircraft-warning">
      {{ presentation.emergency }}
    </p>
    <dl class="gev-aircraft-telemetry">
      <div v-for="row in presentation.telemetry" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
    <dl v-if="presentation.route.length" class="gev-aircraft-route">
      <div v-for="row in presentation.route" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>
    <footer class="gev-aircraft-source">
      <span>{{ presentation.sourceLabel }}: {{ presentation.source }}</span>
      <span>{{ presentation.received }}</span>
      <strong v-if="presentation.stale">{{ presentation.stale }}</strong>
    </footer>
  </article>
</template>
