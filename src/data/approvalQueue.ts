// The ordered list of timesheets the approver is working through (set by the Approvals list when a
// row is opened), so the detail page can offer Previous / Next and "n of N".

export interface QueueItem {
  id: string
  personId: string
  weekStart: string
}

const KEY = 'typeb-hr.approval-queue.v1'
let queue: QueueItem[] = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as QueueItem[]
  } catch {
    return []
  }
})()

export function setApprovalQueue(items: QueueItem[]) {
  queue = items
  try {
    sessionStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

export function getApprovalQueue(): QueueItem[] {
  return queue
}
