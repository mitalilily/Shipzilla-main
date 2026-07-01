import { AddIcon, DeleteIcon, SearchIcon } from '@chakra-ui/icons'
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
  Portal,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Switch,
  Text,
  Tooltip,
  useToast,
  VStack,
} from '@chakra-ui/react'
import CustomModal from 'components/Modal/CustomModal'
import {
  useCouriers,
  useCreateCourier,
  useDeleteCourier,
  useServiceProviders,
  useSyncCourierProviderCatalog,
  useUpdateCourierStatus,
} from 'hooks/useCouriers'
import { useDebounce } from 'hooks/useDebounce'
import { useState } from 'react'

import { GenericTable } from 'views/Dashboard/Tables/components/GenericTable'

const allowedProviders = new Set(['shiprocket'])
const defaultFormData = { businessType: ['b2c', 'b2b'] }
const providerCopy = {
  shiprocket: {
    label: 'Shiprocket Cargo',
    emptyState: 'No live Shiprocket couriers are synced yet.',
  },
}

const formatDateTime = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const Couriers = () => {
  const [filters, setFilters] = useState({
    search: '',
    serviceProvider: '',
  })
  const debouncedSearch = useDebounce(filters.search, 500)
  const { data: rawServiceProviders = [] } = useServiceProviders()
  const serviceProviders = rawServiceProviders.filter((provider) =>
    allowedProviders.has(provider.serviceProvider),
  )
  const providerOptions = serviceProviders.map((provider) => ({
    value: provider.serviceProvider,
    label: provider.serviceProvider === 'shiprocket' ? 'Shiprocket' : provider.serviceProvider,
  }))

  const {
    data: rawCouriers = [],
    isLoading,
    error,
  } = useCouriers({
    search: debouncedSearch || undefined,
    serviceProvider: filters.serviceProvider || undefined,
  })
  const couriers = rawCouriers.filter((courier) => allowedProviders.has(courier.serviceProvider))
  const createCourier = useCreateCourier()
  const deleteCourier = useDeleteCourier()
  const updateCourierStatus = useUpdateCourierStatus()
  const syncProviderCatalog = useSyncCourierProviderCatalog()
  const [isModalOpen, setModalOpen] = useState(false)
  const [openPopoverId, setOpenPopoverId] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)
  const toast = useToast()

  const columnKeys = ['id', 'name', 'serviceProvider', 'businessType', 'isEnabled', 'createdAt']
  const captions = [
    'Courier ID',
    'Courier Name',
    'Service Provider',
    'Business Type',
    'Status',
    'Created At',
  ]

  const setBusinessType = (type) => {
    const currentTypes = formData?.businessType || ['b2c', 'b2b']
    if (currentTypes.includes(type)) {
      const nextTypes = currentTypes.filter((currentType) => currentType !== type)
      if (nextTypes.length) {
        setFormData((prev) => ({ ...prev, businessType: nextTypes }))
      }
      return
    }

    setFormData((prev) => ({ ...prev, businessType: [...currentTypes, type] }))
  }

  const renderers = {
    serviceProvider: (value) => (
      <Badge colorScheme="purple" variant="subtle">
        {providerCopy[value]?.label || value}
      </Badge>
    ),
    isEnabled: (value) => (
      <Text fontWeight="semibold" color={value ? 'green.500' : 'red.500'}>
        {value ? 'Enabled' : 'Disabled'}
      </Text>
    ),
    businessType: (value, row) => {
      const types = Array.isArray(value) ? value : value ? [value] : ['b2c', 'b2b']

      const handleToggle = (type) => {
        let newTypes = []

        if (types.includes(type)) {
          if (types.length === 1) return
          newTypes = types.filter((currentType) => currentType !== type)
        } else {
          newTypes = [...types, type]
        }

        updateCourierStatus.mutate(
          {
            id: row.id,
            serviceProvider: row.serviceProvider,
            businessType: newTypes,
          },
          {
            onSuccess: () => {
              toast({
                title: 'Business type updated successfully',
                status: 'success',
              })
            },
            onError: () => {
              toast({
                title: 'Failed to update business type',
                status: 'error',
              })
            },
          },
        )
      }

      return (
        <HStack spacing={1.5}>
          {['b2c', 'b2b'].map((type) => {
            const isActive = types.includes(type)
            return (
              <Tooltip
                key={type}
                label={isActive ? `Disable ${type.toUpperCase()}` : `Enable ${type.toUpperCase()}`}
                hasArrow
                placement="top"
              >
                <Badge
                  as="button"
                  cursor="pointer"
                  colorScheme={isActive ? (type === 'b2c' ? 'facebook' : 'purple') : 'gray'}
                  variant={isActive ? 'solid' : 'outline'}
                  fontSize="xs"
                  px={2}
                  py={1}
                  borderRadius="md"
                  opacity={isActive ? 1 : 0.5}
                  onClick={() => handleToggle(type)}
                  disabled={updateCourierStatus.isPending}
                >
                  {type.toUpperCase()}
                </Badge>
              </Tooltip>
            )
          })}
        </HStack>
      )
    },
    createdAt: formatDateTime,
  }

  const providerSummaries = serviceProviders.map((provider) => {
    const providerCouriers = couriers.filter(
      (courier) => courier.serviceProvider === provider.serviceProvider,
    )
    const enabledCount = providerCouriers.filter((courier) => courier.isEnabled).length

    return {
      ...provider,
      label: providerCopy[provider.serviceProvider]?.label || provider.serviceProvider,
      visibleCount: providerCouriers.length,
      enabledVisibleCount: enabledCount,
      emptyState:
        providerCopy[provider.serviceProvider]?.emptyState ||
        'No live provider couriers are synced yet.',
    }
  })

  const handleSyncProvider = (serviceProvider) => {
    syncProviderCatalog.mutate(
      { serviceProvider },
      {
        onSuccess: (result) => {
          toast({
            title: `${providerCopy[serviceProvider]?.label || serviceProvider} synced`,
            description: `${result.total} total, ${result.created} new, ${result.updated} refreshed`,
            status: 'success',
          })
        },
        onError: (err) => {
          toast({
            title: `Failed to sync ${providerCopy[serviceProvider]?.label || serviceProvider}`,
            description: err?.response?.data?.message || err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleSave = () => {
    if (!formData?.courierName || !formData?.courierId || !formData?.serviceProvider) {
      toast({ title: 'Please fill all the required fields', status: 'warning' })
      return
    }

    const businessType =
      formData?.businessType && formData.businessType.length > 0
        ? formData.businessType
        : ['b2c', 'b2b']

    createCourier.mutate(
      { ...formData, businessType },
      {
        onSuccess: () => {
          toast({ title: 'Courier added successfully', status: 'success' })
          setFormData(defaultFormData)
          setModalOpen(false)
        },
        onError: (err) => {
          toast({
            title: err?.response?.data?.message ?? 'Failed to add courier',
            status: 'error',
          })
        },
      },
    )
  }

  if (isLoading) return <Spinner size="md" />
  if (error) return <Text color="red.500">Failed to load couriers</Text>

  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }} gap={4}>
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={4}>
        {providerSummaries.map((provider) => (
          <Box key={provider.serviceProvider} borderWidth="1px" borderRadius="lg" p={4}>
            <Stack spacing={3}>
              <HStack justify="space-between" align="flex-start">
                <Box>
                  <Text fontWeight="semibold">{provider.label}</Text>
                  <Text fontSize="sm" color="gray.500">
                    {provider.visibleCount > 0
                      ? `${provider.visibleCount} live couriers available for admin customization.`
                      : provider.emptyState}
                  </Text>
                </Box>
                <Badge colorScheme={provider.visibleCount > 0 ? 'green' : 'orange'}>
                  {provider.visibleCount > 0 ? 'Visible in admin' : 'Sync required'}
                </Badge>
              </HStack>
              <HStack spacing={3} flexWrap="wrap">
                <Badge colorScheme="purple" variant="subtle">
                  {provider.totalCouriers} total synced
                </Badge>
                <Badge colorScheme="green" variant="subtle">
                  {provider.enabledCouriers} enabled
                </Badge>
                <Badge colorScheme="blue" variant="subtle">
                  {provider.enabledVisibleCount} shown in current list
                </Badge>
              </HStack>
              <HStack>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSyncProvider(provider.serviceProvider)}
                  isLoading={
                    syncProviderCatalog.isPending &&
                    syncProviderCatalog.variables?.serviceProvider === provider.serviceProvider
                  }
                >
                  Sync {provider.label}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      serviceProvider:
                        prev.serviceProvider === provider.serviceProvider
                          ? ''
                          : provider.serviceProvider,
                    }))
                  }
                >
                  {filters.serviceProvider === provider.serviceProvider
                    ? 'Show all providers'
                    : 'Filter this provider'}
                </Button>
              </HStack>
            </Stack>
          </Box>
        ))}
      </SimpleGrid>

      <Flex direction={{ base: 'column', md: 'row' }} gap={4} justifyContent="space-between">
        <HStack spacing={3} flex={1} maxW={{ md: '600px' }}>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Search by name or ID..."
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            />
          </InputGroup>
          <Select
            placeholder="All Providers"
            value={filters.serviceProvider}
            onChange={(e) => setFilters((prev) => ({ ...prev, serviceProvider: e.target.value }))}
            maxW="200px"
          >
            {providerOptions.map((provider) => (
              <option key={provider.value} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </Select>
          {(filters.search || filters.serviceProvider) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFilters({ search: '', serviceProvider: '' })}
            >
              Clear
            </Button>
          )}
        </HStack>
        <Button
          colorScheme="brand"
          leftIcon={<AddIcon />}
          onClick={() => {
            setFormData(defaultFormData)
            setModalOpen(true)
          }}
        >
          Add Courier
        </Button>
      </Flex>

      <Text fontSize="sm" color="gray.500">
        Toggle each courier or its business type directly from this table after syncing the live provider catalog.
      </Text>

      <GenericTable
        title="Couriers List"
        data={couriers}
        columnKeys={columnKeys}
        captions={captions}
        renderers={renderers}
        loading={isLoading}
        paginated={false}
        renderActions={(row) => (
          <HStack spacing={3} align="center">
            <Switch
              colorScheme="green"
              isChecked={row.isEnabled}
              onChange={() =>
                updateCourierStatus.mutate(
                  {
                    id: row.id,
                    serviceProvider: row.serviceProvider,
                    isEnabled: !row.isEnabled,
                  },
                  {
                    onSuccess: () => {
                      toast({
                        title: `Courier ${row.isEnabled ? 'disabled' : 'enabled'} successfully`,
                        status: 'success',
                      })
                    },
                    onError: () => {
                      toast({
                        title: 'Failed to update courier status',
                        status: 'error',
                      })
                    },
                  },
                )
              }
            />
            <Popover
              isLazy
              placement="auto"
              closeOnBlur={true}
              isOpen={openPopoverId === row?.id}
              onClose={() => setOpenPopoverId(null)}
            >
              <PopoverTrigger>
                <IconButton
                  icon={<DeleteIcon color="red" />}
                  aria-label="Delete courier"
                  size="sm"
                  onClick={() => setOpenPopoverId(row.id)}
                />
              </PopoverTrigger>
              <Portal>
                <PopoverContent w="200px">
                  <PopoverArrow />
                  <PopoverCloseButton onClick={() => setOpenPopoverId(null)} />
                  <PopoverHeader fontSize="sm">Confirm Delete</PopoverHeader>
                  <PopoverBody fontSize="sm">
                    Are you sure you want to delete <b>{row.name}</b>?
                  </PopoverBody>
                  <PopoverFooter display="flex" justifyContent="flex-end" gap={2}>
                    <Button size="xs" onClick={() => setOpenPopoverId(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      colorScheme="red"
                      isLoading={deleteCourier?.isPending}
                      onClick={() => {
                        deleteCourier.mutate(
                          { id: row.id, serviceProvider: row.serviceProvider },
                          {
                            onSuccess: () => {
                              toast({ title: 'Courier deleted', status: 'success' })
                              setOpenPopoverId(null)
                            },
                            onError: () => {
                              toast({ title: 'Failed to delete', status: 'error' })
                            },
                          },
                        )
                      }}
                    >
                      Delete
                    </Button>
                  </PopoverFooter>
                </PopoverContent>
              </Portal>
            </Popover>
          </HStack>
        )}
      />

      <CustomModal
        isOpen={isModalOpen}
        onClose={() => {
          setModalOpen(false)
          setFormData(defaultFormData)
        }}
        title="Add Courier"
        footer={
          <Flex gap={2}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleSave} isLoading={createCourier?.isPending}>
              Save
            </Button>
          </Flex>
        }
      >
        <VStack spacing={4}>
          <Input
            placeholder="Courier ID"
            required
            isRequired
            value={formData?.courierId || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, courierId: e.target.value }))}
          />
          <Input
            placeholder="Courier Name"
            value={formData?.courierName || ''}
            required
            isRequired
            onChange={(e) => setFormData((prev) => ({ ...prev, courierName: e.target.value }))}
          />

          <Select
            placeholder="Select Service Provider"
            value={formData?.serviceProvider || ''}
            onChange={(e) => setFormData((prev) => ({ ...prev, serviceProvider: e.target.value }))}
            required
            isRequired
          >
            {providerOptions.map((provider) => (
              <option key={provider.value} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </Select>

          <FormControl>
            <FormLabel fontSize="sm" fontWeight="medium" mb={2}>
              Business Type
            </FormLabel>
            <VStack spacing={3} align="stretch">
              <HStack spacing={3}>
                {['b2c', 'b2b'].map((type) => {
                  const isActive = formData?.businessType?.includes(type)
                  return (
                    <Button
                      key={type}
                      flex={1}
                      size="md"
                      colorScheme={isActive ? (type === 'b2c' ? 'blue' : 'purple') : 'gray'}
                      variant={isActive ? 'solid' : 'outline'}
                      onClick={() => setBusinessType(type)}
                    >
                      {type.toUpperCase()}
                    </Button>
                  )
                })}
              </HStack>
              <HStack spacing={2} justify="center">
                {formData?.businessType?.includes('b2c') && <Badge colorScheme="blue">B2C</Badge>}
                {formData?.businessType?.includes('b2b') && <Badge colorScheme="purple">B2B</Badge>}
                {(!formData?.businessType || formData.businessType.length === 0) && (
                  <Text fontSize="xs" color="red.500">
                    Select at least one business type
                  </Text>
                )}
              </HStack>
            </VStack>
          </FormControl>
        </VStack>
      </CustomModal>
    </Flex>
  )
}

export default Couriers
