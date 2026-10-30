<script setup>
// The one drawer: the open destination's heading and close button, the views
// a destination renders itself, and the drawer's host for the legacy panels
// that destination borrows.
import { computed, onMounted, ref } from 'vue';
import { t } from '../i18n/index.js';
import { DRAWER_DESTINATIONS } from './drawerNavigation.js';
import IconButton from './primitives/IconButton.vue';
import PanelHeader from './primitives/PanelHeader.vue';

const props = defineProps({
  drawer: { type: Object, required: true },
  // The drawer's snapshot, painted with each change (see the shell).
  state: { type: Object, default: null },
  // Views by destination id, { component, props }, rendered while it is open.
  views: { type: Object, default: () => ({}) },
});
const body = ref(null);
const panelActions = ref(null);
const destination = computed(() =>
  DRAWER_DESTINATIONS.find((item) => item.id === props.state?.destination),
);
const view = computed(() =>
  props.state?.active ? props.views[props.state?.destination] : null,
);

onMounted(() => {
  body.value.append(props.drawer.host);
  if (props.drawer.headerActions)
    panelActions.value.append(props.drawer.headerActions);
});

function onKeydown(event) {
  if (event.key !== 'Escape' || event.defaultPrevented) return;
  event.preventDefault();
  props.drawer.close({ focus: true });
}
</script>

<template>
  <section
    id="gev-drawer"
    class="gev-drawer"
    :aria-label="
      destination ? t(destination.title ?? destination.label) : undefined
    "
    :hidden="!destination || !state?.active"
    @keydown="onKeydown"
  >
    <!-- Only the header is a token surface: hosted legacy panels keep the
         legacy palette they inherit. -->
    <div class="gev-drawer-header gev-surface">
      <PanelHeader
        :title="destination ? t(destination.title ?? destination.label) : ''"
        :subtitle="destination?.subtitle ? t(destination.subtitle) : undefined"
      >
        <template #actions>
          <!-- Holds the drawer's place for a hosted panel's collapse control
               (drawerNavigation.js); this view renders nothing inside it. -->
          <span ref="panelActions" class="gev-drawer-panel-actions-home"></span>
          <IconButton
            :label="t('Close')"
            size="sm"
            @click="props.drawer.close({ focus: true })"
          >
            <span class="material-symbols-outlined">close</span>
          </IconButton>
        </template>
      </PanelHeader>
    </div>
    <div ref="body" class="gev-drawer-body">
      <component :is="view.component" v-if="view" v-bind="view.props" />
    </div>
  </section>
</template>
