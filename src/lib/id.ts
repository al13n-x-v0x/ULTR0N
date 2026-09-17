/** Shared id generator — avoids store→store import cycles. */
let idc = 1
export const nextId = () => `id_${idc++}_${Math.random().toString(36).slice(2, 7)}`
