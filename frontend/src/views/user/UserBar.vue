<script setup>
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import { useGlobalState } from '../../store'
import { api } from '../../api'
import UserLogin from './UserLogin.vue'

const message = useMessage()
const router = useRouter()

const {
    userSettings, userJwt, userOpenSettings
} = useGlobalState()

const { t } = useI18n({
    messages: {
        en: {
            currentUser: 'Current Login User',
            restoreSessionError: 'Your previous session could not be restored. Please sign in again.',
            restoreConnectionError: 'Unable to restore your session due to a connection or service issue. Refresh later or sign in again.',
        },
        zh: {
            currentUser: '当前登录用户',
            restoreSessionError: '未能恢复上次登录，请重新登录。',
            restoreConnectionError: '暂时无法恢复登录，连接或服务可能异常。请稍后刷新重试，或重新登录。',

        }
    }
});


onMounted(async () => {
    await api.getUserOpenSettings(message);
    // make sure user_id is fetched
    if (!userSettings.value.user_id) await api.getUserSettings(message);
});
</script>

<template>
    <div>
        <n-card :bordered="false" embedded v-if="!userSettings.fetched">
            <n-skeleton style="height: 50vh" />
        </n-card>
        <div v-else-if="userSettings.user_email">
            <n-alert type="success" :show-icon="false" :bordered="false">
                <span>
                    <b>{{ t('currentUser') }} <b>{{ userSettings.user_email }}</b></b>
                </span>
            </n-alert>
        </div>
        <div v-else class="center">
            <n-card :bordered="false" embedded style="max-width: 600px;">
                <n-alert v-if="userJwt && userSettings.restoreError" type="warning" :show-icon="false" :bordered="false" closable>
                    <span>{{ t(userSettings.restoreError === 'session' ? 'restoreSessionError' : 'restoreConnectionError') }}</span>
                </n-alert>
                <UserLogin />
            </n-card>
        </div>
    </div>
</template>

<style scoped>
.n-alert {
    margin-top: 10px;
    margin-bottom: 10px;
    text-align: center;
}

.center {
    display: flex;
    text-align: center;
    place-items: center;
    justify-content: center;
    margin: 20px;
}
</style>
