import {
  Badge,
  Button,
  Flex,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Tooltip,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { useCancelOrderMutation, useRegenerateOrderDocumentsMutation } from 'hooks/useOrders'
import { useMemo, useState } from 'react'
import { FiCopy, FiEye, FiMoreVertical, FiRefreshCw, FiTruck, FiXCircle } from 'react-icons/fi'
import { useHistory } from 'react-router-dom'
import { GenericTable } from 'views/Dashboard/Tables/components/GenericTable'
import OrderDetailsModal from './OrderDetailsModal'

const OrdersTable = ({
  orders,
  totalCount,
  page,
  setPage,
  perPage,
  setPerPage,
  loading = false,
  onRefresh,
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [selectedOrder, setSelectedOrder] = useState(null)
  const history = useHistory()
  const toast = useToast()
  const { mutateAsync: cancelOrderMutation, isPending: isCancelling } = useCancelOrderMutation()
  const {
    mutateAsync: regenerateDocuments,
    isPending: isRegenerating,
  } = useRegenerateOrderDocumentsMutation()

  const cancellableStatuses = useMemo(
    () => new Set(['pending', 'shipment_created', 'in_transit', 'pickup_initiated', 'booked']),
    [],
  )

  const supportedCancellationProviders = useMemo(
    () => new Set(['delhivery', 'ekart', 'xpressbees', 'shipmozo']),
    [],
  )

  const captions = [
    'Order ID',
    'Source',
    'Type',
    'AWB Number',
    'Customer',
    'City',
    'State',
    'Courier',
    'Status',
    'Created At',
  ]
  const columnKeys = [
    'order_number',
    'source',
    'type',
    'awb_number',
    'buyer_name',
    'city',
    'state',
    'courier_partner',
    'order_status',
    'created_at',
  ]
  const actionsColumnWidth = '180px'

  const getStatusColor = (status) => {
    const statusColors = {
      pending: 'orange',
      booked: 'blue',
      manifest_failed: 'red',
      pickup_initiated: 'yellow',
      shipment_created: 'blue',
      in_transit: 'purple',
      out_for_delivery: 'cyan',
      delivered: 'green',
      cancelled: 'red',
      cancellation_requested: 'yellow',
      rto: 'pink',
      rto_in_transit: 'purple',
      rto_delivered: 'gray',
    }
    return statusColors[String(status || '').toLowerCase()] || 'gray'
  }

  const getShipmentType = (order) => {
    const candidates = [order?.type, order?.shipment_type, order?.business_type]
    const normalizedCandidate = candidates.find((value) => {
      const normalized = String(value || '').toLowerCase()
      return normalized === 'b2b' || normalized === 'b2c'
    })

    if (normalizedCandidate) return String(normalizedCandidate).toUpperCase()

    const orderType = String(order?.order_type || '').toLowerCase()
    if (orderType === 'b2b' || orderType === 'b2c') return orderType.toUpperCase()

    return 'N/A'
  }

  const handleViewDetails = (order) => {
    setSelectedOrder(order)
    onOpen()
  }

  const handleOrderUpdated = (updatedOrder) => {
    setSelectedOrder(updatedOrder)
    if (onRefresh) onRefresh()
  }

  const handleCopyAWB = (awb) => {
    if (!awb) return
    navigator.clipboard.writeText(awb)
  }

  const handleTrackShipment = (order) => {
    if (!order?.awb_number) return
    history.push(`/admin/order-tracking?awb=${encodeURIComponent(order.awb_number)}`)
  }

  const canCancelShipment = (order) => {
    if (!order) return false
    const status = String(order.order_status || '').toLowerCase()
    if (!cancellableStatuses.has(status)) return false
    const provider = String(order.integration_type || '').toLowerCase()
    if (provider && !supportedCancellationProviders.has(provider)) return false
    return Boolean(order.id)
  }

  const handleCancelShipment = async (order) => {
    if (!order?.id) {
      toast({
        title: 'Unable to cancel order',
        description: 'Missing order identifier.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
      return
    }

    try {
      await cancelOrderMutation(order.id)
      toast({
        title: 'Cancellation requested',
        description: `Order ${order.order_number || order.id} cancellation has been requested.`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
      if (onRefresh) onRefresh()
    } catch (error) {
      const message =
        error.response?.data?.message || error.message || 'Failed to request cancellation.'
      toast({
        title: 'Cancellation failed',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const handleRegenerateDocuments = async (order) => {
    if (!order?.id) {
      toast({
        title: 'Unable to regenerate',
        description: 'Missing order identifier.',
        status: 'error',
        duration: 4000,
        isClosable: true,
      })
      return
    }

    try {
      await regenerateDocuments({
        orderId: order.id,
        regenerateLabel: true,
        regenerateInvoice: true,
      })
      toast({
        title: 'Regenerated successfully',
        description: `Label and invoice regenerated for order ${order.order_number || order.id}.`,
        status: 'success',
        duration: 4000,
        isClosable: true,
      })
      if (onRefresh) onRefresh()
    } catch (error) {
      const message =
        error?.response?.data?.message || error?.message || 'Failed to regenerate documents.'
      toast({
        title: 'Regeneration failed',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    }
  }

  const renderers = {
    order_number: (value) => (
      <Tooltip label={value}>
        <span
          style={{
            maxWidth: '160px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            fontWeight: 'bold',
          }}
        >
          {value || 'N/A'}
        </span>
      </Tooltip>
    ),
    source: (value, row) => (
      <Badge colorScheme={row?.is_external_api ? 'purple' : 'green'} borderRadius="md" px={2} py={1}>
        {row?.is_external_api ? 'API' : value || 'Local'}
      </Badge>
    ),
    type: (_value, row) => (
      <Badge colorScheme="blue" fontSize="0.8em" px={2} py={1} borderRadius="md">
        {getShipmentType(row)}
      </Badge>
    ),
    awb_number: (value, row) => (
      <Flex align="center" gap={2}>
        {value ? (
          <Button
            variant="link"
            colorScheme="orange"
            size="sm"
            fontFamily="mono"
            onClick={() => handleTrackShipment(row)}
          >
            {value}
          </Button>
        ) : (
          <span style={{ fontFamily: 'monospace' }}>N/A</span>
        )}
        {value && (
          <Icon
            as={FiCopy}
            cursor="pointer"
            onClick={() => handleCopyAWB(value)}
            color="gray.500"
            _hover={{ color: 'blue.500' }}
          />
        )}
      </Flex>
    ),
    buyer_name: (value, row) => (
      <div>
        <div style={{ fontWeight: '500' }}>{value || 'N/A'}</div>
        {row.buyer_phone && (
          <div style={{ fontSize: '0.85em', color: 'gray' }}>{row.buyer_phone}</div>
        )}
      </div>
    ),
    city: (value) => value || 'N/A',
    state: (value) => value || 'N/A',
    courier_partner: (value) => value || 'Not Assigned',
    order_status: (value) => (
      <Badge colorScheme={getStatusColor(value)} fontSize="0.8em" px={2} py={1} borderRadius="md">
        {String(value || 'unknown').replace(/_/g, ' ').toUpperCase()}
      </Badge>
    ),
    created_at: (value, row) => {
      const resolvedValue = value || row?.order_date
      if (!resolvedValue) return 'N/A'

      const date = new Date(resolvedValue)

      return (
        date.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
        ', ' +
        date.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      )
    },
  }

  const renderActions = (order) => (
    <Menu placement="bottom-end">
      <MenuButton as={Button} size="sm" variant="ghost" rightIcon={<FiMoreVertical />}>
        Actions
      </MenuButton>
      <Portal>
        <MenuList zIndex={2000} boxShadow="xl">
          <MenuItem icon={<FiEye />} onClick={() => handleViewDetails(order)}>
            View Details
          </MenuItem>
          <MenuItem
            icon={<FiRefreshCw />}
            onClick={() => handleRegenerateDocuments(order)}
            isDisabled={isRegenerating}
          >
            Regenerate Label & Invoice
          </MenuItem>
          {order.awb_number && (
            <MenuItem icon={<FiTruck />} onClick={() => handleTrackShipment(order)}>
              Track Shipment
            </MenuItem>
          )}
          {canCancelShipment(order) && (
            <MenuItem
              icon={<FiXCircle />}
              onClick={() => handleCancelShipment(order)}
              isDisabled={isCancelling}
            >
              Cancel Shipment
            </MenuItem>
          )}
        </MenuList>
      </Portal>
    </Menu>
  )

  return (
    <>
      <GenericTable
        title="Orders Management"
        data={orders}
        captions={captions}
        columnKeys={columnKeys}
        renderers={renderers}
        renderActions={renderActions}
        loading={loading}
        paginated={true}
        page={page}
        setPage={setPage}
        totalCount={totalCount}
        perPage={perPage}
        setPerPage={setPerPage}
        perPageOptions={[10, 20, 50, 100]}
        actionsColumnWidth={actionsColumnWidth}
        columnWidths={{
          order_number: '180px',
          source: '120px',
          type: '110px',
          awb_number: '180px',
          buyer_name: '220px',
          city: '140px',
          state: '140px',
          courier_partner: '170px',
          order_status: '150px',
          created_at: '180px',
        }}
      />

      {selectedOrder && (
        <OrderDetailsModal
          isOpen={isOpen}
          onClose={onClose}
          order={selectedOrder}
          onOrderUpdated={handleOrderUpdated}
        />
      )}
    </>
  )
}

export default OrdersTable
