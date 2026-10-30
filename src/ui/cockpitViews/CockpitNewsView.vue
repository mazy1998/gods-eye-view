<script setup>
defineProps({
  news: { type: Object, required: true },
});
</script>
<template>
  <div
    id="cockpit-news-status"
    class="cockpit-brief-status"
    :data-state="news.statusState || undefined"
    :hidden="news.statusHidden"
  >
    {{ news.statusText }}
  </div>
  <ol id="cockpit-news-list" class="cockpit-news-list" aria-live="polite">
    <li v-for="article in news.articles" :key="article.key">
      <a :href="article.url" target="_blank" rel="noopener noreferrer"
        ><strong>{{ article.title }}</strong
        ><span>{{ article.meta }}</span></a
      >
    </li>
  </ol>
</template>
