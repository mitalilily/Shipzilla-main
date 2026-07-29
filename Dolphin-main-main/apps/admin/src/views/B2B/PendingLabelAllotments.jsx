import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tr,
  useDisclosure,
  useToast,
} from '@chakra-ui/react'
import { useCallback, useEffect, useState } from 'react'
import { b2bAdminService } from 'services/b2bAdmin.service'

const pendingLabel = (status) =>
  ({
    awaiting_awb_allotment: 'Waiting for AWB allotment',
    label_processing: 'Uploading label',
    allotment_failed: 'Allotment failed',
  })[status] || status

export default function PendingLabelAllotments() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ awb: '', courierName: '', note: '', label: null, manifest: null })
  const { isOpen, onOpen, onClose } = useDisclosure()
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await b2bAdminService.getPendingLabelAllotments({ search, limit: 100 })
      setRows(result.rows)
    } catch (error) {
      toast({ title: 'Could not load pending B2B labels', status: 'error' })
    } finally {
      setLoading(false)
    }
  }, [search, toast])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const openAllotment = (row) => {
    setSelected(row)
    setForm({
      awb: row.provider_awb || '',
      courierName: row.courier_partner || '',
      note: '',
      label: null,
      manifest: null,
    })
    onOpen()
  }

  const submit = async () => {
    if (!form.awb.trim() || !form.label) {
      toast({ title: 'AWB and label PDF are required', status: 'warning' })
      return
    }
    const body = new FormData()
    body.append('awb', form.awb.trim())
    body.append('courierName', form.courierName.trim())
    body.append('note', form.note.trim())
    body.append('label', form.label)
    if (form.manifest) body.append('manifest', form.manifest)
    setSaving(true)
    try {
      await b2bAdminService.allotAwb(selected.id, body)
      toast({ title: `AWB allotted to ${selected.order_number}`, status: 'success' })
      onClose()
      await load()
    } catch (error) {
      toast({
        title: 'Allotment failed',
        description: error?.response?.data?.error || error.message,
        status: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box pt={{ base: '130px', md: '100px' }} px={{ base: 3, md: 6 }}>
      <Heading size="lg">B2B Pending Label Allotment</Heading>
      <Text color="gray.600" mt={2}>
        Upload the courier label to release the real AWB to the client.
      </Text>
      <Input
        mt={5}
        maxW="420px"
        placeholder="Search order, AWB, company or consignee"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <Box mt={5} bg="white" borderRadius="16px" overflowX="auto" boxShadow="sm">
        {loading ? (
          <Box p={12} textAlign="center"><Spinner /></Box>
        ) : (
          <Table size="sm">
            <Thead><Tr>
              <Th>Order / Client</Th><Th>Booked</Th><Th>Courier IDs</Th><Th>Route</Th>
              <Th>Boxes / Weight</Th><Th>Status</Th><Th>Action</Th>
            </Tr></Thead>
            <Tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td><Text fontWeight="700">{row.order_number}</Text><Text>{row.company_name || row.client_email || '-'}</Text></Td>
                  <Td>{row.created_at ? new Date(row.created_at).toLocaleString('en-IN') : '-'}</Td>
                  <Td><Text>{row.courier_partner || 'Shiprocket'}</Text><Text fontSize="xs">Shipment: {row.shipment_id || '-'}</Text><Text fontSize="xs">Internal AWB: {row.provider_awb || 'Pending'}</Text></Td>
                  <Td>{row.pickup_details?.pincode || '-'} → {row.destination_pincode || '-'}</Td>
                  <Td>{Array.isArray(row.packages) ? row.packages.length : 0} / {row.weight || '-'} kg<br />{row.payment_mode || '-'}</Td>
                  <Td><Badge colorScheme={row.label_allotment_status === 'allotment_failed' ? 'red' : 'orange'}>{pendingLabel(row.label_allotment_status)}</Badge></Td>
                  <Td><Button size="sm" colorScheme="purple" onClick={() => openAllotment(row)}>Upload & allot</Button></Td>
                </Tr>
              ))}
              {!rows.length && <Tr><Td colSpan={7} textAlign="center" py={10}>No B2B labels are pending.</Td></Tr>}
            </Tbody>
          </Table>
        )}
      </Box>

      <Modal isOpen={isOpen} onClose={saving ? undefined : onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Allot AWB — {selected?.order_number}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired mb={4}><FormLabel>AWB number</FormLabel><Input value={form.awb} onChange={(e) => setForm({ ...form, awb: e.target.value })} /></FormControl>
            <FormControl mb={4}><FormLabel>Courier name</FormLabel><Input value={form.courierName} onChange={(e) => setForm({ ...form, courierName: e.target.value })} /></FormControl>
            <FormControl isRequired mb={4}><FormLabel>Original courier label (PDF)</FormLabel><Input type="file" accept="application/pdf,.pdf" p={1} onChange={(e) => setForm({ ...form, label: e.target.files?.[0] || null })} /></FormControl>
            <FormControl mb={4}><FormLabel>Manifest / LR (optional PDF)</FormLabel><Input type="file" accept="application/pdf,.pdf" p={1} onChange={(e) => setForm({ ...form, manifest: e.target.files?.[0] || null })} /></FormControl>
            <FormControl><FormLabel>Admin note</FormLabel><Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></FormControl>
          </ModalBody>
          <ModalFooter><Button mr={3} onClick={onClose} isDisabled={saving}>Cancel</Button><Button colorScheme="purple" onClick={submit} isLoading={saving}>Save and allot AWB</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
