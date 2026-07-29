import { useQueryClient } from '@tanstack/react-query'
import { Alert, AlertTitle, Box, Button, Link, Stack, Typography } from '@mui/material'
import { saveAs } from 'file-saver'
import moment from 'moment'
import { useState } from 'react'
import { MdCancel, MdDescription, MdLocalShipping, MdVisibility } from 'react-icons/md'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { bulkDownloadOrderDocumentsService } from '../../../api/order.service'
import {
  useB2BOrdersByUser,
  useCancelShipment,
  useGenerateManifest,
  useRegenerateOrderDocuments,
} from '../../../hooks/Orders/useOrders'
import { usePresignedDownloadMutation } from '../../../hooks/Uploads/usePresignedDownloadUrls'
import type { B2BOrder } from '../../../types/generic.types'
import { toast } from '../../UI/Toast'
import StatusChip from '../../UI/chip/StatusChip'
import DataTable, { type Column } from '../../UI/table/DataTable'
import TableSkeleton from '../../UI/table/TableSkeleton'
import {
  downloadFile,
  type DocumentType,
  getActionableErrorMessage,
  getDocumentReference,
  getDownloadFileName,
} from '../bulkActionUtils'
import ManifestScheduleDialog, { type ManifestSchedulePayload } from '../ManifestScheduleDialog'
import OrderActionsMenu, { type OrderActionMenuItem } from '../OrderActionsMenu'
import { buildOrderTrackingPath } from '../orderNavigation'

export const statusColorMap: Record<string, 'success' | 'pending' | 'error' | 'info'> = {
  delivered: 'success',
  processing: 'pending',
  cancelled: 'error',
  pending: 'info',
  shipment_booked: 'info',
  manifest_generated: 'success',
}

interface B2BOrdersListProps {
  page: number
  rowsPerPage: number
  setPage: (page: number) => void
  setRowsPerPage: (rows: number) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: any
}

type BulkFeedback = {
  severity: 'info' | 'success' | 'error' | 'warning'
  title: string
  message: string
}

const renderDateTimeCell = (value: unknown) => {
  if (!value) return '-'
  const parsed = moment(value)
  if (!parsed.isValid()) return '-'

  return (
    <Stack spacing={0.15}>
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{parsed.format('DD MMM YYYY')}</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {parsed.format('hh:mm:ss A')}
      </Typography>
    </Stack>
  )
}

const B2BOrdersList = ({
  page,
  rowsPerPage,
  setPage,
  setRowsPerPage,
  filters,
}: B2BOrdersListProps) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useB2BOrdersByUser(page, rowsPerPage, filters)
  const { mutate: triggerManifest, isPending: isGeneratingManifest } = useGenerateManifest()
  const { mutateAsync: regenerateDocuments, isPending: regeneratingDocuments } =
    useRegenerateOrderDocuments()
  const { mutate: cancelShipment, isPending: cancellingShipment } = useCancelShipment()
  const { mutateAsync: presignDownloads } = usePresignedDownloadMutation()
  const [manifestingAwb, setManifestingAwb] = useState<string | null>(null)
  const [manifestDialogOrder, setManifestDialogOrder] = useState<B2BOrder | null>(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Array<B2BOrder['id']>>([])
  const [selectionResetToken, setSelectionResetToken] = useState(0)
  const [bulkFeedback, setBulkFeedback] = useState<BulkFeedback | null>(null)
  const [downloadingLabels, setDownloadingLabels] = useState(false)
  const orders: B2BOrder[] = data?.orders || []
  const selectedOrders = orders.filter((order) => selectedOrderIds.includes(order.id))
  const isAwaitingAllotment = (order: B2BOrder) =>
    Boolean(order.label_allotment_status) && !order.awb_released_at

  const clearSelection = () => {
    setSelectedOrderIds([])
    setSelectionResetToken((current) => current + 1)
  }

  const getB2BManifestIdentifier = (order: B2BOrder) =>
    String(order.awb_number || order.shipment_id || order.order_id || order.order_number || '').trim()

  const handleGenerateManifest = (order: B2BOrder, schedule: ManifestSchedulePayload) => {
    const manifestRef = getB2BManifestIdentifier(order)
    if (!manifestRef) {
      toast.open({
        message: `Manifest cannot be started for ${order.order_number} yet.`,
        severity: 'error',
      })
      return
    }

    setManifestingAwb(manifestRef)
    triggerManifest(
      { awbs: [manifestRef], type: 'b2b', ...schedule },
      {
        onSettled: () => {
          setManifestingAwb((current) => (current === manifestRef ? null : current))
          setManifestDialogOrder(null)
        },
      },
    )
  }

  const hasLabelGenerated = (row: B2BOrder) =>
    Boolean(String(row.label_url || row.label_key || row.label || '').trim())

  const hasInvoiceGenerated = (row: B2BOrder) =>
    Boolean(String(row.invoice_url || row.invoice_key || row.invoice_link || '').trim())

  const hasManifestGenerated = (row: B2BOrder) =>
    Boolean(String(row.manifest_url || row.manifest_key || row.manifest || '').trim())

  const isCancellable = (row: B2BOrder) => {
    const status = String(row.order_status || '').trim().toLowerCase()
    const cancellableStatuses = new Set([
      'pending',
      'booked',
      'shipment_booked',
      'pickup_initiated',
      'pickup_scheduled',
    ])
    return (
      cancellableStatuses.has(status) &&
      Boolean(
        String(row.awb_number || '').trim() ||
          String(row.shipment_id || '').trim() ||
          String(row.order_id || '').trim(),
      )
    )
  }

  const handleRegenerateDocuments = async (
    order: B2BOrder,
    regenerateLabel = true,
    regenerateInvoice = true,
  ) => {
    await regenerateDocuments({
      orderId: String(order.id),
      regenerateLabel,
      regenerateInvoice,
    })
  }

  const handleDownloadDocument = async (order: B2BOrder, type: DocumentType) => {
    const { key, url } = getDocumentReference({ ...order, type: 'b2b' }, type)

    if (!key && !url) {
      toast.open({
        message: `${type[0].toUpperCase()}${type.slice(1)} is not available yet for ${order.order_number}.`,
        severity: 'warning',
      })
      return
    }

    const fileName = getDownloadFileName({ ...order, type: 'b2b' }, type, key || url)

    if (url) {
      await downloadFile(url, fileName)
      return
    }

    if (!key) return

    const presignedUrls = await presignDownloads({ keys: [key] })
    const resolvedUrl = Array.isArray(presignedUrls) ? presignedUrls[0] : null
    if (!resolvedUrl) {
      toast.open({
        message: `Failed to prepare ${type} download for ${order.order_number}.`,
        severity: 'error',
      })
      return
    }

    await downloadFile(resolvedUrl, fileName)
  }

  const handleBulkLabelDownload = async () => {
    if (!selectedOrders.length) {
      const message = 'Select at least one B2B order to download labels.'
      setBulkFeedback({
        severity: 'error',
        title: 'No orders selected',
        message,
      })
      toast.open({ message, severity: 'error' })
      return
    }

    setDownloadingLabels(true)
    setBulkFeedback({
      severity: 'info',
      title: 'Downloading labels',
      message: `Preparing ${selectedOrders.length} selected B2B order(s) in one PDF.`,
    })

    try {
      const result = await bulkDownloadOrderDocumentsService(
        selectedOrders.map((order) => order.id),
        'label',
      )

      saveAs(result.blob, result.fileName)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['b2bOrdersByUser'] }),
        queryClient.invalidateQueries({ queryKey: ['orders'] }),
      ])

      const warningMessage = result.warnings.length
        ? ` ${result.warnings.slice(0, 3).join(' ')}${
            result.warnings.length > 3 ? ` +${result.warnings.length - 3} more issue(s).` : ''
          }`
        : ''
      const message = `Downloaded one PDF with ${result.mergedCount || selectedOrders.length} label(s).${warningMessage}`
      setBulkFeedback({
        severity: result.warnings.length ? 'warning' : 'success',
        title: result.warnings.length ? 'Labels downloaded with warnings' : 'Labels downloaded',
        message,
      })
      toast.open({ message, severity: result.warnings.length ? 'info' : 'success' })
    } catch (error) {
      console.error('Bulk B2B label download failed:', error)
      const message = getActionableErrorMessage(
        error,
        'Failed to download selected B2B labels. Please try again.',
      )
      setBulkFeedback({
        severity: 'error',
        title: 'Label download failed',
        message,
      })
      toast.open({ message, severity: 'error' })
    } finally {
      setDownloadingLabels(false)
    }
  }

  const columns: Column<B2BOrder>[] = [
    {
      label: 'Source',
      id: 'is_external_api',
      render: (_, row) => (
        <StatusChip
          label={row.is_external_api ? 'API' : 'Local'}
          status={row.is_external_api ? 'info' : 'success'}
        />
      ),
    },
    { label: 'Order #', id: 'order_number' },
    {
      label: 'AWB',
      id: 'awb_number',
      render: (v, row) => {
        if (isAwaitingAllotment(row)) {
          return (
            <StatusChip
              label={row.awb_display || 'Waiting for AWB allotment'}
              status="pending"
            />
          )
        }
        const trackingPath = buildOrderTrackingPath(row)
        if (!trackingPath) return v || '-'

        return (
          <Link
            component={RouterLink}
            to={trackingPath}
            underline="hover"
            onClick={(event) => event.stopPropagation()}
            sx={{ fontWeight: 700 }}
          >
            {v}
          </Link>
        )
      },
    },
    {
      label: 'Docs',
      id: 'id',
      minWidth: 220,
      sticky: 'right',
      stickyOffset: 140,
      render: (_v, row) => (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <StatusChip
            label={
              isAwaitingAllotment(row)
                ? 'Admin allotment pending'
                : hasLabelGenerated(row)
                  ? 'Label Generated'
                  : 'Label Pending'
            }
            status={hasLabelGenerated(row) ? 'success' : 'pending'}
          />
          <StatusChip
            label={hasInvoiceGenerated(row) ? 'Invoice Generated' : 'Invoice Pending'}
            status={hasInvoiceGenerated(row) ? 'success' : 'pending'}
          />
          <StatusChip
            label={hasManifestGenerated(row) ? 'Manifest Generated' : 'Manifest Pending'}
            status={hasManifestGenerated(row) ? 'success' : 'pending'}
          />
        </Stack>
      ),
    },
    {
      label: 'Buyer',
      id: 'buyer_name',
      render: (v, row) => (
        <Stack spacing={0.25}>
          <Typography sx={{ fontWeight: 700 }}>{v || '-'}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {row.buyer_phone || 'No phone'}
          </Typography>
        </Stack>
      ),
    },
    { label: 'Amount', id: 'order_amount', render: (v) => `Rs ${Number(v ?? 0).toFixed(2)}` },
    { label: 'Courier', id: 'courier_partner' },
    {
      label: 'Source',
      id: 'is_external_api',
      render: (_, row) => (
        <StatusChip
          label={row.is_external_api ? 'API' : 'Local'}
          status={row.is_external_api ? 'info' : 'success'}
        />
      ),
    },
    {
      label: 'Status',
      id: 'order_status',
      minWidth: 150,
      sticky: 'right',
      stickyOffset: 360,
      render: (v, row) => (
        <StatusChip
          label={row.client_shipment_status || v}
          status={isAwaitingAllotment(row) ? 'pending' : statusColorMap[String(v)] || 'info'}
        />
      ),
    },
    { label: 'Order Date', id: 'order_date', render: (v) => renderDateTimeCell(v) },
    { label: 'Last Updated', id: 'updated_at', render: (v) => renderDateTimeCell(v) },
    {
      label: 'Actions',
      id: 'id',
      minWidth: 160,
      sticky: 'right',
      stickyOffset: 0,
      render: (_, row) => {
        const pendingAllotment = isAwaitingAllotment(row)
        const trackingPath = pendingAllotment ? null : buildOrderTrackingPath(row)
        const manifestRef = getB2BManifestIdentifier(row)
        const isThisManifesting = isGeneratingManifest && manifestingAwb === manifestRef
        const hasLabelDocument = hasLabelGenerated(row)
        const hasInvoiceDocument = hasInvoiceGenerated(row)
        const hasManifestDocument = hasManifestGenerated(row)
        const canManifest = !pendingAllotment && Boolean(manifestRef) && !hasManifestDocument

        const actions: OrderActionMenuItem[] = [
          ...(trackingPath
            ? [
                {
                  key: 'view-details',
                  label: 'View Details',
                  icon: <MdVisibility size={18} />,
                  onClick: () => navigate(trackingPath),
                },
                {
                  key: 'track-shipment',
                  label: 'Track Shipment',
                  icon: <MdLocalShipping size={18} />,
                  onClick: () => navigate(trackingPath),
                },
              ]
            : []),
          ...(canManifest
            ? [
                {
                  key: 'generate-manifest',
                  label: isThisManifesting ? 'Manifesting...' : 'Generate Manifest',
                  icon: <MdLocalShipping size={18} />,
                  disabled: isThisManifesting,
                  onClick: () => setManifestDialogOrder(row),
                },
              ]
            : []),
          {
            key: 'generate-label',
            label: pendingAllotment
              ? 'Label pending admin allotment'
              : regeneratingDocuments
                ? 'Generating Label...'
                : 'Generate Label',
            icon: <MdDescription size={18} />,
            disabled: pendingAllotment || regeneratingDocuments,
            onClick: () => handleRegenerateDocuments(row, true, false),
          },
          {
            key: 'generate-invoice',
            label: regeneratingDocuments ? 'Generating Invoice...' : 'Generate Invoice',
            icon: <MdDescription size={18} />,
            disabled: regeneratingDocuments,
            onClick: () => handleRegenerateDocuments(row, false, true),
          },
          ...(hasLabelDocument
            ? [
                {
                  key: 'download-label',
                  label: 'Download Label',
                  icon: <MdDescription size={18} />,
                  onClick: () => handleDownloadDocument(row, 'label'),
                },
              ]
            : []),
          ...(hasInvoiceDocument
            ? [
                {
                  key: 'download-invoice',
                  label: 'Download Invoice',
                  icon: <MdDescription size={18} />,
                  onClick: () => handleDownloadDocument(row, 'invoice'),
                },
              ]
            : []),
          ...(hasManifestDocument
            ? [
                {
                  key: 'download-manifest',
                  label: 'Download Manifest',
                  icon: <MdDescription size={18} />,
                  onClick: () => handleDownloadDocument(row, 'manifest'),
                },
              ]
            : []),
          ...(row.manifest
            ? [
                {
                  key: 'view-manifest',
                  label: 'View Manifest',
                  icon: <MdVisibility size={18} />,
                  onClick: () =>
                    window.open(String(row.manifest), '_blank', 'noopener,noreferrer'),
                },
              ]
            : []),
          ...(isCancellable(row)
            ? [
                {
                  key: 'cancel-shipment',
                  label: cancellingShipment ? 'Cancelling...' : 'Cancel Shipment',
                  icon: <MdCancel size={18} />,
                  danger: true,
                  disabled: cancellingShipment,
                  onClick: () => cancelShipment(String(row.id)),
                },
              ]
            : []),
        ]

        return <OrderActionsMenu actions={actions} />
      },
    },
  ]

  if (isError)
    return (
      <Typography color="error" textAlign="center" py={4}>
        Failed to fetch B2B orders
      </Typography>
    )

  return (
    <Stack spacing={2}>
      {bulkFeedback && (
        <Alert
          severity={bulkFeedback.severity}
          onClose={() => setBulkFeedback(null)}
          sx={{ alignItems: 'flex-start' }}
        >
          <AlertTitle>{bulkFeedback.title}</AlertTitle>
          {bulkFeedback.message}
        </Alert>
      )}

      <Box
        sx={{
          p: 2,
          borderRadius: '10px',
          border: '1px solid rgba(51, 51, 105, 0.14)',
          backgroundColor: 'rgba(51, 51, 105, 0.04)',
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          alignItems={{ xs: 'flex-start', lg: 'center' }}
          justifyContent="space-between"
          gap={2}
        >
          <Box>
            <Typography sx={{ fontWeight: 700, color: '#5D2394', fontSize: '15px' }}>
              {selectedOrders.length} B2B order{selectedOrders.length > 1 ? 's' : ''} selected
            </Typography>
            <Typography sx={{ color: '#6E6483', fontSize: '13px', mt: 0.5 }}>
              Bulk labels download as one PDF. Missing labels are generated during download.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
            <Button
              variant="outlined"
              onClick={handleBulkLabelDownload}
              disabled={downloadingLabels || !selectedOrders.length}
              sx={{ textTransform: 'none' }}
            >
              {downloadingLabels ? 'Downloading...' : 'Download Labels'}
            </Button>
            <Button
              variant="text"
              onClick={() => {
                clearSelection()
                setBulkFeedback(null)
              }}
              sx={{ textTransform: 'none' }}
            >
              Clear
            </Button>
          </Stack>
        </Stack>
      </Box>

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <DataTable<B2BOrder>
          rows={orders}
          columns={columns}
          title="My B2B Orders"
          pagination
          selectable
          currentPage={page}
          defaultRowsPerPage={rowsPerPage}
          totalCount={data?.totalCount || 0}
          onPageChange={(newPage) => {
            setPage(newPage)
            clearSelection()
            setBulkFeedback(null)
          }}
          onRowsPerPageChange={(newLimit) => {
            setRowsPerPage(newLimit)
            setPage(1)
            clearSelection()
            setBulkFeedback(null)
          }}
          onSelectRows={(ids) => setSelectedOrderIds(ids)}
          selectedRowIds={selectedOrderIds}
          selectionResetToken={selectionResetToken}
        />
      )}

      <ManifestScheduleDialog
        open={Boolean(manifestDialogOrder)}
        title={`Generate Manifest - ${manifestDialogOrder?.order_number || ''}`}
        orderCount={1}
        loading={isGeneratingManifest}
        onClose={() => setManifestDialogOrder(null)}
        onSubmit={(schedule) => {
          if (!manifestDialogOrder) return
          handleGenerateManifest(manifestDialogOrder, schedule)
        }}
      />
    </Stack>
  )
}

export default B2BOrdersList
