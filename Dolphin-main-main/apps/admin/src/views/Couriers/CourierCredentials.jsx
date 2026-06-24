import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Input,
  SimpleGrid,
  Spinner,
  Text,
  useToast,
  VStack,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import {
  useCourierCredentials,
  useUpdateIcarryCredentials,
  useUpdateShiprocketCredentials,
} from 'hooks/useCouriers'

const CourierCredentials = () => {
  const toast = useToast()
  const { data, isLoading, error } = useCourierCredentials()
  const updateShiprocket = useUpdateShiprocketCredentials()
  const updateIcarry = useUpdateIcarryCredentials()

  const [shiprocketForm, setShiprocketForm] = useState({
    apiBase: '',
    username: '',
    password: '',
    apiKey: '',
    webhookSecret: '',
  })
  const [icarryForm, setIcarryForm] = useState({
    apiBase: '',
    username: '',
    clientId: '',
    password: '',
    apiKey: '',
    webhookSecret: '',
  })

  useEffect(() => {
    if (data?.shiprocket) {
      setShiprocketForm({
        apiBase: data.shiprocket.apiBase || '',
        username: data.shiprocket.username || '',
        password: '',
        apiKey: '',
        webhookSecret: '',
      })
    }
    if (data?.icarry) {
      setIcarryForm({
        apiBase: data.icarry.apiBase || '',
        username: data.icarry.username || '',
        clientId: data.icarry.clientId || '',
        password: '',
        apiKey: '',
        webhookSecret: '',
      })
    }
  }, [data])

  const handleSaveShiprocket = () => {
    updateShiprocket.mutate(
      {
        apiBase: shiprocketForm.apiBase,
        username: shiprocketForm.username,
        ...(shiprocketForm.password ? { password: shiprocketForm.password } : {}),
        ...(shiprocketForm.apiKey ? { apiKey: shiprocketForm.apiKey } : {}),
        ...(shiprocketForm.webhookSecret ? { webhookSecret: shiprocketForm.webhookSecret } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Shiprocket credentials updated', status: 'success' })
          setShiprocketForm((prev) => ({
            ...prev,
            password: '',
            apiKey: '',
            webhookSecret: '',
          }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Shiprocket credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleSaveIcarry = () => {
    updateIcarry.mutate(
      {
        apiBase: icarryForm.apiBase,
        username: icarryForm.username,
        clientId: icarryForm.clientId,
        ...(icarryForm.password ? { password: icarryForm.password } : {}),
        ...(icarryForm.apiKey ? { apiKey: icarryForm.apiKey } : {}),
        ...(icarryForm.webhookSecret ? { webhookSecret: icarryForm.webhookSecret } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'iCarry credentials updated', status: 'success' })
            setIcarryForm((prev) => ({
              ...prev,
              password: '',
              apiKey: '',
              webhookSecret: '',
            }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update iCarry credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  if (isLoading) return <Spinner size="md" />
  if (error) return <Text color="red.500">Failed to load courier credentials</Text>

  return (
    <Flex direction="column" pt={{ base: '120px', md: '75px' }} gap={4}>
      <Text fontSize="xl" fontWeight="bold">
        Courier Credentials
      </Text>

      <SimpleGrid columns={{ base: 1, xl: 2 }} gap={4}>
        <Box borderWidth="1px" borderRadius="lg" p={5}>
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center" gap={3}>
              <Text fontWeight="semibold">Shiprocket Cargo</Text>
              <Badge
                colorScheme={
                  data?.shiprocket?.hasApiKey || data?.shiprocket?.hasPassword ? 'green' : 'orange'
                }
              >
                {data?.shiprocket?.hasApiKey || data?.shiprocket?.hasPassword
                  ? 'Configured'
                  : 'Missing credentials'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={shiprocketForm.apiBase}
                onChange={(e) =>
                  setShiprocketForm((prev) => ({ ...prev, apiBase: e.target.value }))
                }
                placeholder="https://apiv2.shiprocket.in/v1/external"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input
                value={shiprocketForm.username}
                onChange={(e) =>
                  setShiprocketForm((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="Shiprocket email"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={shiprocketForm.password}
                onChange={(e) =>
                  setShiprocketForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Leave blank to keep saved password"
              />
            </FormControl>

            <FormControl>
              <FormLabel>API Token</FormLabel>
              <Input
                type="password"
                value={shiprocketForm.apiKey}
                onChange={(e) =>
                  setShiprocketForm((prev) => ({ ...prev, apiKey: e.target.value }))
                }
                placeholder={data?.shiprocket?.apiKeyMasked || 'Shiprocket API token'}
              />
              {!!data?.shiprocket?.apiKeyMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current token: {data.shiprocket.apiKeyMasked}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Webhook URL</FormLabel>
              <Input
                value="https://api.shipzilla.in/api/webhook/shiprocket"
                isReadOnly
              />
            </FormControl>

            <FormControl>
              <FormLabel>Webhook Secret</FormLabel>
              <Input
                type="password"
                value={shiprocketForm.webhookSecret}
                onChange={(e) =>
                  setShiprocketForm((prev) => ({ ...prev, webhookSecret: e.target.value }))
                }
                placeholder="Leave blank to keep saved webhook secret"
              />
            </FormControl>

            <Button
              colorScheme="blue"
              onClick={handleSaveShiprocket}
              isLoading={updateShiprocket.isPending}
              alignSelf="flex-start"
            >
              Save Shiprocket Cargo Credentials
            </Button>
          </VStack>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" p={5}>
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center" gap={3}>
              <Text fontWeight="semibold">iCarry</Text>
              <Badge
                colorScheme={
                  data?.icarry?.hasApiKey || data?.icarry?.hasPassword ? 'green' : 'orange'
                }
              >
                {data?.icarry?.hasApiKey || data?.icarry?.hasPassword
                  ? 'Configured'
                  : 'Ready to add'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={icarryForm.apiBase}
                onChange={(e) => setIcarryForm((prev) => ({ ...prev, apiBase: e.target.value }))}
                placeholder="Enter iCarry API base URL"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Username</FormLabel>
              <Input
                value={icarryForm.username}
                onChange={(e) =>
                  setIcarryForm((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="iCarry username or email"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Client / Warehouse ID</FormLabel>
              <Input
                value={icarryForm.clientId}
                onChange={(e) =>
                  setIcarryForm((prev) => ({ ...prev, clientId: e.target.value }))
                }
                placeholder="iCarry client or warehouse identifier"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={icarryForm.password}
                onChange={(e) => setIcarryForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Leave blank to keep saved password"
              />
            </FormControl>

            <FormControl>
              <FormLabel>API Token</FormLabel>
              <Input
                type="password"
                value={icarryForm.apiKey}
                onChange={(e) => setIcarryForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder={data?.icarry?.apiKeyMasked || 'iCarry API token'}
              />
              {!!data?.icarry?.apiKeyMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current token: {data.icarry.apiKeyMasked}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Webhook Secret</FormLabel>
              <Input
                type="password"
                value={icarryForm.webhookSecret}
                onChange={(e) =>
                  setIcarryForm((prev) => ({ ...prev, webhookSecret: e.target.value }))
                }
                placeholder="Leave blank to keep saved webhook secret"
              />
            </FormControl>

            <Button
              colorScheme="blue"
              onClick={handleSaveIcarry}
              isLoading={updateIcarry.isPending}
              alignSelf="flex-start"
            >
              Save iCarry Rate Card Credentials
            </Button>
          </VStack>
        </Box>
      </SimpleGrid>
    </Flex>
  )
}

export default CourierCredentials
