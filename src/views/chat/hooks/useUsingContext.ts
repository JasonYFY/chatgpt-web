import { computed } from 'vue'
import { useMessage } from 'naive-ui'
import { t } from '@/locales'
import { useChatStore,useSettingStore } from '@/store'

const ms = useMessage();

export function useUsingContext() {

	const chatStore = useChatStore();
  const usingContext = computed<boolean>(() => chatStore.usingContext);

  function toggleUsingContext() {
    chatStore.setUsingContext(!usingContext.value);
    if (usingContext.value)
      ms.success(t('chat.turnOnContext'))
    else
      ms.warning(t('chat.turnOffContext'))
  }

  return {
    usingContext,
    toggleUsingContext,
  }
}

export function useUsingGpt4() {
	const settingStore = useSettingStore();
	const usingGpt4 = computed<boolean>(() => settingStore.usingGpt4);

	function toggleUsingGpt4() {
		settingStore.usingGpt4 = !usingGpt4.value;
		if (usingGpt4.value)
			ms.success(t('chat.turnOnGPT4'));
		else
			ms.warning(t('chat.turnOffGPT4'));
	}

	return {
		usingGpt4,
		toggleUsingGpt4,
	}
}
