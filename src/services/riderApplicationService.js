import { apiRequest, apiUploadRequest } from './apiClient';

const riderPath = (riderId) => `/applications/riders/${encodeURIComponent(riderId)}`;

export const riderApplicationService = {
  startOrResume: () => apiRequest('/applications/riders', { method: 'POST', body: {} }),
  updateDraft: (riderId, body) => apiRequest(riderPath(riderId), { method: 'PATCH', body }),
  uploadDocument(riderId, docType, file, onProgress) {
    const body = new FormData();
    body.append('doc_type', docType);
    body.append('file', file);
    return apiUploadRequest(`${riderPath(riderId)}/documents`, body, { onProgress });
  },
  deleteDocument: (riderId, documentId) => apiRequest(
    `${riderPath(riderId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  ),
  getApplicantDocumentUrl: (riderId, documentId) => apiRequest(
    `${riderPath(riderId)}/documents/${encodeURIComponent(documentId)}/download-url`,
  ),
  submit: (riderId) => apiRequest(`${riderPath(riderId)}/submit`, {
    method: 'POST',
    body: { terms_accepted: true },
  }),
  sendActivationOtp: (riderId) => apiRequest(`${riderPath(riderId)}/activation/otp`, {
    method: 'POST',
    body: {},
  }),
  verifyActivation: (riderId, code) => apiRequest(`${riderPath(riderId)}/activation/verify`, {
    method: 'POST',
    body: { code },
  }),
  listAdminApplications: (params = {}) => {
    const query = new URLSearchParams({ type: 'rider', ...params });
    return apiRequest(`/admin/applications?${query}`, { preserveEnvelope: true });
  },
  getAdminApplication: (riderId) => apiRequest(
    `/admin/applications/rider/${encodeURIComponent(riderId)}`,
  ),
  reviewAction: (riderId, action, body = {}) => apiRequest(
    `/admin/applications/rider/${encodeURIComponent(riderId)}/${action}`,
    { method: 'POST', body },
  ),
  getAdminDocumentUrl: (riderId, documentId) => apiRequest(
    `/admin/riders/${encodeURIComponent(riderId)}/documents/${encodeURIComponent(documentId)}/download-url`,
  ),
};
