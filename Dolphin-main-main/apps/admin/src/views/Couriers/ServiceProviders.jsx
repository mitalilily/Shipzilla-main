import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  SimpleGrid,
  Spinner,
  Stack,
  Switch,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
  useToast,
} from '@chakra-ui/react'
import {
  useServiceProviders,
  useSyncCourierProviderCatalog,
  useUpdateServiceProviderStatus,
} from 'hooks/useCouriers'

const allowedProviders = new Set(['shiprocket', 'shipmozo'])
const providerCopy = {
  shiprocket: {
    label: 'Shiprocket Cargo',
    note: 'Sync real Shiprocket carrier catalog and control provider availability.',
  },
  shipmozo: {
    label: 'Shipmozo',
    note: 'Fetch the live Shipmozo courier catalog and control which couriers stay visible.',
  },
}

const ServiceProviders = () => {
  const { data: rawProviders = [], isLoading, error } = useServiceProviders()
  const providers = rawProviders.filter((provider) => allowedProviders.has(provider.serviceProvider))
  const updateStatus = useUpdateServiceProviderStatus()
  const syncProviderCatalog = useSyncCourierProviderCatalog()
  const toast = useToast()

  if (isLoading) return <Spinner size="md" />
  if (error) return <Text color="red.500">Failed to load service providers</Text>

  const handleToggle = (provider) => {
    updateStatus.mutate(
      { serviceProvider: provider.serviceProvider, isEnabled: !provider.isEnabled },
      {
        onSuccess: () => {
          toast({
            title: `Provider ${provider.isEnabled ? 'disabled' : 'enabled'} successfully`,
            status: 'success',
          })
        },
        onError: () => {
          toast({
            title: 'Failed to update provider status',
            status: 'error',
          })
        },
      },
    )
  }

  const handleSync = (provider) => {
    syncProviderCatalog.mutate(
      { serviceProvider: provider.serviceProvider },
      {
        onSuccess: (result) => {
          toast({
            title: `${provider.serviceProvider} couriers synced`,
            description: `${result.total} total, ${result.created} new, ${result.updated} refreshed`,
            status: 'success',
          })
        },
        onError: (error) => {
          toast({
            title: `Failed to sync ${provider.serviceProvider} couriers`,
            description: error?.response?.data?.message || error?.message,
            status: 'error',
          })
        },
      },
    )
  }

  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }} gap={4}>
      <Text fontSize="xl" fontWeight="bold">
        Service Providers
      </Text>
      <Text fontSize="sm" color="gray.500">
        Keep the live carrier integration visible, synced, and ready for courier-level control.
      </Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
        {providers.map((provider) => {
          const copy = providerCopy[provider.serviceProvider] || {
            label: provider.serviceProvider,
            note: 'Manage courier availability for this provider.',
          }
          return (
            <Box key={provider.serviceProvider} borderWidth="1px" borderRadius="lg" p={4}>
              <Stack spacing={3}>
                <HStack justify="space-between" align="flex-start">
                  <Box>
                    <Text fontWeight="semibold">{copy.label}</Text>
                    <Text fontSize="sm" color="gray.500">
                      {copy.note}
                    </Text>
                  </Box>
                  <Badge colorScheme={provider.totalCouriers > 0 ? 'green' : 'orange'}>
                    {provider.totalCouriers > 0 ? 'Catalog synced' : 'Awaiting sync'}
                  </Badge>
                </HStack>
                <HStack spacing={3}>
                  <Badge colorScheme="purple" variant="subtle">
                    {provider.totalCouriers} total
                  </Badge>
                  <Badge colorScheme="green" variant="subtle">
                    {provider.enabledCouriers} enabled
                  </Badge>
                </HStack>
              </Stack>
            </Box>
          )
        })}
      </SimpleGrid>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Provider</Th>
            <Th isNumeric>Total Couriers</Th>
            <Th isNumeric>Enabled Couriers</Th>
            <Th>Status</Th>
            <Th textAlign="right">Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {providers.length === 0 ? (
            <Tr>
              <Td colSpan={5} textAlign="center">
                <Text color="gray.500">No service provider data found.</Text>
              </Td>
            </Tr>
          ) : (
            providers.map((p) => (
              <Tr key={p.serviceProvider}>
                <Td>
                  <Stack spacing={0.5}>
                    <Text fontWeight="semibold">
                      {providerCopy[p.serviceProvider]?.label || p.serviceProvider}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {p.serviceProvider}
                    </Text>
                  </Stack>
                </Td>
                <Td isNumeric>{p.totalCouriers}</Td>
                <Td isNumeric>{p.enabledCouriers}</Td>
                <Td>
                  <Text fontWeight="semibold" color={p.isEnabled ? 'green.500' : 'red.500'}>
                    {p.isEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </Td>
                <Td>
                  <HStack justify="flex-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSync(p)}
                      isLoading={
                        syncProviderCatalog.isPending &&
                        syncProviderCatalog.variables?.serviceProvider === p.serviceProvider
                      }
                    >
                      Sync Couriers
                    </Button>
                    <Switch
                      colorScheme="green"
                      isChecked={p.isEnabled}
                      isDisabled={updateStatus.isPending}
                      onChange={() => handleToggle(p)}
                    />
                  </HStack>
                </Td>
              </Tr>
            ))
          )}
        </Tbody>
      </Table>
    </Flex>
  )
}

export default ServiceProviders
