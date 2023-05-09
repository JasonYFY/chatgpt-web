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

export function useUsingGPT4() {
	const settingStore = useSettingStore();
	const usingGPT4 = computed<boolean>(() => settingStore.usingGPT4);

	function toggleUsingGPT4() {
		settingStore.usingGPT4 = !usingGPT4.value;
		if (usingGPT4.value)
			ms.success(t('chat.turnOnGPT4'));
		else
			ms.warning(t('chat.turnOffGPT4'));
	}

	return {
		usingGPT4,
		toggleUsingGPT4,
	}
}
