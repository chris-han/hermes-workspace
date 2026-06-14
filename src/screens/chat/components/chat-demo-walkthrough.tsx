'use client'

import Joyride, { ACTIONS, STATUS } from 'react-joyride'
import type { CallBackProps, Step, Styles } from 'react-joyride'

import { useResolvedTheme } from '@/hooks/use-chat-settings'

const DEMO_WALKTHROUGH_STEPS: Array<Step> = [
  {
    target: '[data-tour="chat-composer-input"]',
    placement: 'top',
    disableBeacon: true,
    title: '在真实聊天输入框里运行',
    content:
      '第一条示例分析已经放进输入框。这里就是实际发送给 Semantier 的内容，不再打开独立弹窗。',
  },
  {
    target: '[data-tour="chat-composer-send"]',
    placement: 'top',
    title: '用真实发送按钮开始',
    content:
      '点击这里发送第一条示例分析。发送后引导会自动关闭，结果会直接出现在当前会话里。',
  },
]

export function shouldCompleteDemoWalkthrough(
  action: string,
  status: string,
): boolean {
  return (
    action === ACTIONS.CLOSE ||
    status === STATUS.FINISHED ||
    status === STATUS.SKIPPED
  )
}

export function ChatDemoWalkthrough({
  run,
  onClose,
}: {
  run: boolean
  onClose: () => void
}) {
  const resolvedTheme = useResolvedTheme()
  const isDark = resolvedTheme === 'dark'

  const styles: Partial<Styles> = {
    options: {
      primaryColor: '#a7d36b',
      backgroundColor: isDark ? '#161817' : '#ffffff',
      textColor: isDark ? '#f3f4f6' : '#1f2937',
      overlayColor: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.5)',
      arrowColor: isDark ? '#161817' : '#ffffff',
      zIndex: 10000,
    },
    tooltip: {
      borderRadius: 14,
      fontSize: 14,
      padding: 18,
    },
    tooltipTitle: {
      fontSize: 16,
      fontWeight: 600,
      marginBottom: 8,
      color: isDark ? '#f9fafb' : '#111827',
    },
    tooltipContent: {
      fontSize: 14,
      lineHeight: 1.6,
      color: isDark ? '#e5e7eb' : '#374151',
    },
    buttonNext: {
      backgroundColor: '#a7d36b',
      color: '#0f172a',
      borderRadius: 8,
      padding: '8px 16px',
      fontSize: 14,
      fontWeight: 600,
    },
    buttonBack: {
      color: isDark ? '#9ca3af' : '#6b7280',
      marginRight: 8,
      fontSize: 14,
    },
    buttonSkip: {
      color: isDark ? '#9ca3af' : '#6b7280',
      fontSize: 14,
    },
    spotlight: {
      borderRadius: 12,
    },
  }

  function handleCallback(data: CallBackProps) {
    if (shouldCompleteDemoWalkthrough(data.action, data.status)) {
      onClose()
    }
  }

  return (
    <Joyride
      steps={DEMO_WALKTHROUGH_STEPS}
      run={run}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      spotlightClicks
      disableOverlayClose
      callback={handleCallback}
      styles={styles}
      locale={{
        back: '上一步',
        close: '关闭',
        last: '完成',
        next: '下一步',
        skip: '跳过引导',
      }}
      floaterProps={{
        styles: {
          floater: {
            filter: 'drop-shadow(0 10px 15px rgba(0, 0, 0, 0.18))',
          },
        },
      }}
      spotlightPadding={6}
    />
  )
}
