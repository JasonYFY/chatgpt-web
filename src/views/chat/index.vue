<script setup lang='ts'>
import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { NAutoComplete, NButton, NInput, useDialog, useMessage,NSelect,NUpload,UploadFileInfo,UploadCustomRequestOptions } from 'naive-ui'
import html2canvas from 'html2canvas'
import { Message } from './components'
import { useScroll } from './hooks/useScroll'
import { useChat } from './hooks/useChat'
import { useUsingContext } from './hooks/useUsingContext'
import HeaderComponent from './components/Header/index.vue'
import { HoverButton, SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useChatStore, usePromptStore } from '@/store'
import { fetchChatAPIProcess } from '@/api'
import { t } from '@/locales'
import request from '@/utils/request/axios'

let controller = new AbortController()

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'

const route = useRoute()
const dialog = useDialog()
const ms = useMessage()

const chatStore = useChatStore()

const { isMobile } = useBasicLayout()
const { addChat, updateChat, updateChatSome, getChatByUuidAndIndex } = useChat()
const { scrollRef, scrollToBottom, scrollToBottomIfAtBottom } = useScroll()
const { usingContext, toggleUsingContext } = useUsingContext()

const { uuid } = route.params as { uuid: string }

const dataSources = computed(() => chatStore.getChatByUuid(+uuid))
const modelValue = computed(() => chatStore.getModelByUuid(+uuid))
const conversationList = computed(() => dataSources.value.filter(item => (!item.inversion && !!item.conversationOptions)))


const prompt = ref<string>('')
const loading = ref<boolean>(false)
const inputRef = ref<Ref | null>(null)


// 添加PromptStore
const promptStore = usePromptStore()

// 使用storeToRefs，保证store修改后，联想部分能够重新渲染
const { promptList: promptTemplate } = storeToRefs<any>(promptStore)

// 未知原因刷新页面，loading 状态不会重置，手动重置
dataSources.value.forEach((item, index) => {
  if (item.loading)
    updateChatSome(+uuid, index, { loading: false })
})

function handleSubmit() {
  onConversation()
}
function parseResponseText(responseText:any) {

	let lastLineObject;
  let combinedText = '';
	try {
		// 将字符串按行拆分
		const lines = responseText.split('\n');
		if(lines.length===1){
			const obj = JSON.parse(lines[0]);
			if(obj.status==='Bard'){
				return obj.data;
			}
		}
		// 获取最后一行的文本内容
		const lastLine = lines[lines.length - 1];
		lastLineObject = JSON.parse(lastLine); // 将最后一行解析为对象

		// 将所有行的文本内容合并在一起
		for (let i = 0; i < lines.length; i++) {
			let line = lines[i];
			if(line.trim() === '') continue;
			const obj = JSON.parse(line);
			combinedText += obj.text;
		}
	}catch (error) {
		 // 捕获异常并向上抛出
		 console.log('responseText的信息：',responseText);
		 //console.log('lineError的信息：',lineError);
		 console.log('parseResponseText方法报错了',error);
		 //不抛出了
		 //throw error;
  }

	// 更新最后一行对象的 text 属性
	lastLineObject.text = combinedText;
	return lastLineObject;
}

async function onConversation() {
  let message = prompt.value

  if (loading.value){
    return
  }

  if (!message || message.trim() === '')
    return

  controller = new AbortController()

	addChat(
		+uuid,
		{
			dateTime: new Date().toLocaleString(),
			text: message,
			inversion: true,
			imageLink: imageFileList.value?.imageLink,
			imageFileName:imageFileList.value?.imageFileName,
			error: false,
			conversationOptions: null,
			requestOptions: { prompt: message, options: null },
		},
	)
	scrollToBottom()


  loading.value = true
  prompt.value = ''
  const imageName = imageFileList.value?.imageFileName
  //清空上传的文件
  //imageFileList.value.clear()
  imageFileList.value=[]

  let options: Chat.ConversationRequest = {}
  const lastContext = conversationList.value[conversationList.value.length - 1]?.conversationOptions

  if (lastContext && usingContext.value)
    options = { ...lastContext }

  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      loading: true,
      inversion: false,
      imageFileName:imageName,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )
  scrollToBottom()

	let indexTemp = dataSources.value.length - 1;

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
    	indexTemp = dataSources.value.length - 1;
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: message,
        options,
        model: modelValue.value,
        imageFileName:imageName,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          try {
            const data = parseResponseText(responseText)
            updateChat(
              +uuid,
              indexTemp,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + (data.text ?? ''),
                inversion: false,
                error: false,
                loading: true,
                imageFileName:imageName,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
              },
            )

            if (openLongReply && data.detail && data.detail.choices[0].finish_reason === 'length') {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }

            scrollToBottomIfAtBottom()
          }
          catch (error) {
          	console.log('报错了',error);
            //
          }
        },
      })
      updateChatSome(+uuid, indexTemp, { loading: false })
    }

    await fetchChatAPIOnce()
  }
  catch (error: any) {

    const errorMessage = error?.message ?? t('common.wrong')

    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        indexTemp,
        {
          loading: false,
        },
      )
      scrollToBottomIfAtBottom()
      return
    }
		console.log('报错了',error);
    const currentChat = getChatByUuidAndIndex(+uuid, indexTemp)

    if (currentChat?.text && currentChat.text !== '' && currentChat.text !== 'undefined') {
      updateChatSome(
        +uuid,
        indexTemp,
        {
          text: `${currentChat.text}\n[${errorMessage}]`,
          error: false,
          loading: false,
        },
      )
      return
    }

    updateChat(
      +uuid,
      indexTemp,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        imageFileName:imageName,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
    scrollToBottomIfAtBottom()
  }
  finally {
    loading.value = false
  }
}

async function onRegenerate(index: number) {
  if (loading.value)
    return

  controller = new AbortController()

  const { requestOptions,imageFileName } = dataSources.value[index]

  let message = requestOptions?.prompt ?? ''


  let options: Chat.ConversationRequest = {}

  if (requestOptions.options)
    options = { ...requestOptions.options }

	loading.value = true

  updateChat(
    +uuid,
    index,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      inversion: false,
      error: false,
      loading: true,
      imageFileName: imageFileName,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: message,
        options,
        model: modelValue.value,
        imageFileName:imageFileName,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          try {
            const data = parseResponseText(responseText)
            updateChat(
              +uuid,
              index,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + (data.text ?? ''),
                inversion: false,
                error: false,
                loading: true,
                imageFileName:imageFileName,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
              },
            )

            if (openLongReply && data.detail && data.detail.choices[0].finish_reason === 'length') {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }
          }
          catch (error) {
          	console.log('报错：',error);

          }
        },
      })
      updateChatSome(+uuid, index, { loading: false })
    }
    await fetchChatAPIOnce()
  }
  catch (error: any) {
    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        index,
        {
          loading: false,
        },
      )
      return
    }

    const errorMessage = error?.message ?? t('common.wrong')

    updateChat(
      +uuid,
      index,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        imageFileName:imageFileName,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
  }
  finally {
    loading.value = false
  }
}

function handleExport() {
  if (loading.value)
    return

  const d = dialog.warning({
    title: t('chat.exportImage'),
    content: t('chat.exportImageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: async () => {
      try {
        d.loading = true
        const ele = document.getElementById('image-wrapper')
        const canvas = await html2canvas(ele as HTMLDivElement, {
          useCORS: true,
        })
        const imgUrl = canvas.toDataURL('image/png')
        const tempLink = document.createElement('a')
        tempLink.style.display = 'none'
        tempLink.href = imgUrl
        tempLink.setAttribute('download', 'chat-shot.png')
        if (typeof tempLink.download === 'undefined')
          tempLink.setAttribute('target', '_blank')

        document.body.appendChild(tempLink)
        tempLink.click()
        document.body.removeChild(tempLink)
        window.URL.revokeObjectURL(imgUrl)
        d.loading = false
        ms.success(t('chat.exportSuccess'))
        Promise.resolve()
      }
      catch (error: any) {
        ms.error(t('chat.exportFailed'))
      }
      finally {
        d.loading = false
      }
    },
  })
}

function handleDelete(index: number) {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.deleteMessage'),
    content: t('chat.deleteMessageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.deleteChatByUuid(+uuid, index)
    },
  })
}

function quoteText(text: string) {
	prompt.value = text
}

function handleClear() {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.clearChat'),
    content: t('chat.clearChatConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.clearChatByUuid(+uuid)
    },
  })
}

function handleEnter(event: KeyboardEvent) {
  if (!isMobile.value) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
  else {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
}

function handleStop() {
  if (loading.value) {
    controller.abort()
    loading.value = false
  }
}

// 可优化部分
// 搜索选项计算，这里使用value作为索引项，所以当出现重复value时渲染异常(多项同时出现选中效果)
// 理想状态下其实应该是key作为索引项,但官方的renderOption会出现问题，所以就需要value反renderLabel实现
const searchOptions = computed(() => {
  if (prompt.value.startsWith('/')) {
    return promptTemplate.value.filter((item: { key: string }) => item.key.toLowerCase().includes(prompt.value.substring(1).toLowerCase())).map((obj: { value: any }) => {
      return {
        label: obj.value,
        value: obj.value,
      }
    })
  }
  else {
    return []
  }
})

// value反渲染key
const renderOption = (option: { label: string }) => {
  for (const i of promptTemplate.value) {
    if (i.value === option.label)
      return [i.key]
  }
  return []
}

const placeholder = computed(() => {
  if (isMobile.value)
    return t('chat.placeholderMobile')
  return t('chat.placeholder')
})

const buttonDisabled = computed(() => {
  return loading.value || !prompt.value || prompt.value.trim() === ''
})

const footerClass = computed(() => {
  let classes = ['p-4']
  if (isMobile.value)
    classes = ['sticky', 'left-0', 'bottom-0', 'right-0', 'p-2', 'pr-3', 'overflow-hidden']
  return classes
})

onMounted(() => {
  scrollToBottom()
  if (inputRef.value && !isMobile.value)
    inputRef.value?.focus()
})

onUnmounted(() => {
  if (loading.value)
    controller.abort()
})

const model = computed({
  get() {
    return modelValue.value
  },
  set(value: string) {
  	console.log('set设置了')
  },
})

const modelOptions: { label: string; value: string }[] = [
  { label: 'GPT3',value: 'gpt-3.5-turbo' },
  { label: 'Bard',value: 'bard' },
]

function setModel(model: string) {
	let lastModel = modelValue.value
	chatStore.setModelValue(model,+uuid)
	if (lastModel !== model) {
		ms.success(t('chat.switchModel'))
	}

}

// 重点是onFinish，文件上传结束的回调，可以修改传入的 UploadFileInfo 或者返回一个新的 UploadFileInfo。
//注意：file 将会下一次事件循环中被置为 null
const uploadRef = ref();  // 添加 ref
let imageFileList = ref();  // 添加 ref

const Upload = ({
                     file,
                     data,
                     headers,
                     withCredentials,
                     action,
                     onFinish,
                     onError,
                     onProgress
                   }: UploadCustomRequestOptions) => {

  // 后端需要的参数
  const requestData = {
    type: 'BSCL',
    file: imageFileList.value[0].file,
  }

  // 接口请求
  request({
    url: '/upload',
    method: 'post',
    data:requestData,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...headers,
    },
    onUploadProgress: (progressEvent) => {
			const percentd = Math.round((progressEvent.loaded / progressEvent.total!) * 100);
			//console.log(percentd);
			//onProgress({ percent: percentd })
			imageFileList.value[0].percentage=percentd
		},
    withCredentials: withCredentials || false,
  })
    .then((res) => {
      //console.log(res)
      imageFileList.value.imageFileName = res.data.file.filename
      // 通过 FileReader 将文件转换为 base64 字符串
			const reader = new FileReader();
			reader.onload = (event) => {
				// 将 base64 字符串保存到数据属性中
				imageFileList.value.imageLink = event.target?.result;
			};
			// 读取文件内容
			// 创建一个新的 Blob 对象
			const blob = new Blob([imageFileList.value[0].file]);
			reader.readAsDataURL(blob);
			ms.success('success')
      // 注意清空，要不接口会重复调用
      //onFinish()
      imageFileList.value[0].status="finished"
    })
    .catch((err) => {
    	//console.log(err)
      ms.error(err.message ?? 'error')
			imageFileList.value[0].status="error"
      //onError()
    })
}


const beforeUpload = (data: {
              file: UploadFileInfo
              fileList: UploadFileInfo[]
            })=>{
	if (data.file.file?.type !== 'image/png' && data.file.file?.type !== 'image/jpeg') {
		ms.error('只能上传图片文件，请重新上传')
		return false
	}
	return true
}

// 监听粘贴操作
function handlePaste(event: ClipboardEvent)
{
	const items = (event.clipboardData || (window as any).clipboardData).items;
	let file = null;
	if (!items || items.length === 0) {
		ms.error("当前浏览器不支持本地");
		return;
	}
	// 搜索剪切板items
	for (let i = 0; i < items.length; i++) {
		if (items[i].type.indexOf("image") !== -1) {
			file = items[i].getAsFile();
			break;
		}
	}
	if (file && modelValue.value === 'bard') {
		//debugger;
		imageFileList.value = [
			{
				id: '1',
				name: file.name,
				status: 'uploading',
				type: file.type,
				file:file
			},
		]
		//uploadRef.value.submit()
		Upload(file)
		//ms.error("粘贴内容图片");
		// 取消默认动作
		//event.preventDefault();
		return;
	}
}

</script>

<template>
  <div class="flex flex-col w-full h-full">
    <HeaderComponent
      v-if="isMobile"
      :using-context="usingContext"
      @export="handleExport"
      @toggle-using-context="toggleUsingContext"
      @handle-clear="handleClear"
    />
    <main class="flex-1 overflow-hidden">
      <div id="scrollRef" ref="scrollRef" class="h-full overflow-hidden overflow-y-auto">
        <div
          id="image-wrapper"
          class="w-full m-auto dark:bg-[#101014]"
          :class="[isMobile ? 'p-2' : 'p-4']"
        >
          <template v-if="!dataSources.length">
            <div class="flex items-center justify-center mt-4 text-center text-neutral-300">
              <SvgIcon icon="ri:bubble-chart-fill" class="mr-2 text-3xl" />
              <span style="text-align: left;">
								<p>1.此网站对接ChatGPT,知识截止于2021年9月</p>
								<p>2.想体验实时知识，可以切换Bard模型</p>
							</span>
            </div>
          </template>
          <template v-else>
            <div>
              <Message
                v-for="(item, index) of dataSources"
                :key="index"
                :date-time="item.dateTime"
                :text="item.text"
                :inversion="item.inversion"
                :error="item.error"
                :loading="item.loading"
                :imageLink="item.imageLink"
                :imageFileName="item.imageFileName"
                @quote="quoteText(item.text)"
                @regenerate="onRegenerate(index)"
                @delete="handleDelete(index)"
              />
              <div class="sticky bottom-0 left-0 flex justify-center">
                <NButton v-if="loading" type="warning" @click="handleStop">
                  <template #icon>
                    <SvgIcon icon="ri:stop-circle-line" />
                  </template>
                  {{ t('common.stopResponding') }}
                </NButton>
              </div>
            </div>
          </template>
        </div>
      </div>
    </main>
    <footer :class="footerClass">
      <div class="w-full m-auto">
        <div class="flex items-center justify-between space-x-2">
          <HoverButton v-if="!isMobile" @click="handleClear">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:delete-bin-line" />
            </span>
          </HoverButton>
          <HoverButton v-if="!isMobile" @click="handleExport">
            <span class="text-xl text-[#4f555e] dark:text-white">
              <SvgIcon icon="ri:download-2-line" />
            </span>
          </HoverButton>
          <HoverButton v-if="!isMobile" @click="toggleUsingContext">
            <span class="text-xl" :class="{ 'text-[#4b9e5f]': usingContext, 'text-[#a8071a]': !usingContext }">
              <SvgIcon icon="ri:chat-history-line" />
            </span>
          </HoverButton>
					<NSelect
						style="width: 104px"
						:value="model"
						:options="modelOptions"
						@update-value="value => setModel(value)"
					/>
					<NUpload
					v-if="modelValue === 'bard'"
					style="font-size: 10px;"
					ref="uploadRef"
					list-type="image-card"
					action=""
					maxSize="10mb"
					accept="image/png, image/jpeg"
					@before-upload="beforeUpload"
					:custom-request="Upload"
					v-model:file-list="imageFileList"
					:max="1"
					>
					图片上传
					</NUpload>
          <NAutoComplete v-model:value="prompt" :options="searchOptions" :render-label="renderOption">
            <template #default="{ handleInput, handleBlur, handleFocus }">
              <NInput
                ref="inputRef"
                v-model:value="prompt"
                type="textarea"
                :placeholder="placeholder"
                :autosize="{ minRows: 1, maxRows: isMobile ? 4 : 8 }"
                @input="handleInput"
                @focus="handleFocus"
                @blur="handleBlur"
                @keypress="handleEnter"
								v-on:paste="handlePaste"
              />
            </template>
          </NAutoComplete>
          <NButton type="primary" :disabled="buttonDisabled" @click="handleSubmit">
            <template #icon>
              <span class="dark:text-black">
                <SvgIcon icon="ri:send-plane-fill" />
              </span>
            </template>
          </NButton>
        </div>
      </div>
    </footer>
  </div>
</template>
<style lang="less">
.n-upload-trigger.n-upload-trigger--image-card,.n-upload,.n-upload-file-list .n-upload-file.n-upload-file--image-card-type{
	width: 50px;
	height: 40px;
}
</style>
