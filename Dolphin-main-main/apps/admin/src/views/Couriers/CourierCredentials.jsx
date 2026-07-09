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
  useUpdateShipmozoCredentials,
  useUpdateShiprocketCredentials,
} from 'hooks/useCouriers'

const CourierCredentials = () => {
  const toast = useToast()
  const { data, isLoading, error } = useCourierCredentials()
  const updateShipmozo = useUpdateShipmozoCredentials()
  const updateShiprocket = useUpdateShiprocketCredentials()

  const [shipmozoForm, setShipmozoForm] = useState({
    apiBase: '',
    username: '',
    password: '',
    publicKey: '',
    privateKey: '',
    webhookSecret: '',
  })
  const [shiprocketForm, setShiprocketForm] = useState({
    apiBase: '',
    accessToken: '',
    refreshToken: '',
    webhookSecret: '',
  })

  useEffect(() => {
    if (data?.shipmozo) {
      setShipmozoForm({
        apiBase: data.shipmozo.apiBase || '',
        username: data.shipmozo.username || '',
        password: '',
        publicKey: data.shipmozo.publicKey || '',
        privateKey: '',
        webhookSecret: '',
      })
    }
    if (data?.shiprocket) {
      setShiprocketForm({
        apiBase: data.shiprocket.apiBase || '',
        accessToken: '',
        refreshToken: '',
        webhookSecret: '',
      })
    }
  }, [data])

  const handleSaveShipmozo = () => {
    updateShipmozo.mutate(
      {
        apiBase: shipmozoForm.apiBase,
        username: shipmozoForm.username,
        publicKey: shipmozoForm.publicKey,
        ...(shipmozoForm.password ? { password: shipmozoForm.password } : {}),
        ...(shipmozoForm.privateKey ? { privateKey: shipmozoForm.privateKey } : {}),
        ...(shipmozoForm.webhookSecret ? { webhookSecret: shipmozoForm.webhookSecret } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Shipmozo credentials updated', status: 'success' })
          setShipmozoForm((prev) => ({
            ...prev,
            password: '',
            privateKey: '',
            webhookSecret: '',
          }))
        },
        onError: (err) => {
          toast({
            title: 'Failed to update Shipmozo credentials',
            description: err?.message,
            status: 'error',
          })
        },
      },
    )
  }

  const handleSaveShiprocket = () => {
    updateShiprocket.mutate(
      {
        apiBase: shiprocketForm.apiBase,
        ...(shiprocketForm.accessToken ? { accessToken: shiprocketForm.accessToken } : {}),
        ...(shiprocketForm.refreshToken ? { refreshToken: shiprocketForm.refreshToken } : {}),
        ...(shiprocketForm.webhookSecret ? { webhookSecret: shiprocketForm.webhookSecret } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: 'Shiprocket credentials updated', status: 'success' })
          setShiprocketForm((prev) => ({
            ...prev,
            accessToken: '',
            refreshToken: '',
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
              <Text fontWeight="semibold">Shipmozo</Text>
              <Badge
                colorScheme={
                  data?.shipmozo?.hasPrivateKey || data?.shipmozo?.hasPassword ? 'green' : 'orange'
                }
              >
                {data?.shipmozo?.hasPrivateKey || data?.shipmozo?.hasPassword
                  ? 'Configured'
                  : 'Missing credentials'}
              </Badge>
            </Flex>

            <FormControl>
              <FormLabel>API Base URL</FormLabel>
              <Input
                value={shipmozoForm.apiBase}
                onChange={(e) => setShipmozoForm((prev) => ({ ...prev, apiBase: e.target.value }))}
                placeholder="https://shipping-api.com/app/api/v1"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Username</FormLabel>
              <Input
                value={shipmozoForm.username}
                onChange={(e) =>
                  setShipmozoForm((prev) => ({ ...prev, username: e.target.value }))
                }
                placeholder="Shipmozo username"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Password</FormLabel>
              <Input
                type="password"
                value={shipmozoForm.password}
                onChange={(e) =>
                  setShipmozoForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Leave blank to keep saved password"
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Public Key</FormLabel>
              <Input
                value={shipmozoForm.publicKey}
                onChange={(e) =>
                  setShipmozoForm((prev) => ({ ...prev, publicKey: e.target.value }))
                }
                placeholder="Shipmozo public key"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Private Key</FormLabel>
              <Input
                type="password"
                value={shipmozoForm.privateKey}
                onChange={(e) =>
                  setShipmozoForm((prev) => ({ ...prev, privateKey: e.target.value }))
                }
                placeholder={data?.shipmozo?.privateKeyMasked || 'Leave blank to keep saved private key'}
              />
              {!!data?.shipmozo?.privateKeyMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current private key: {data.shipmozo.privateKeyMasked}
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>Webhook URL</FormLabel>
              <Input value="https://api.shipzilla.in/api/webhook/shipmozo" isReadOnly />
            </FormControl>

            <FormControl>
              <FormLabel>Webhook Secret</FormLabel>
              <Input
                type="password"
                value={shipmozoForm.webhookSecret}
                onChange={(e) =>
                  setShipmozoForm((prev) => ({ ...prev, webhookSecret: e.target.value }))
                }
                placeholder="Leave blank to keep saved webhook secret"
              />
            </FormControl>

            <Button
              colorScheme="blue"
              onClick={handleSaveShipmozo}
              isLoading={updateShipmozo.isPending}
              alignSelf="flex-start"
            >
              Save Shipmozo Credentials
            </Button>
          </VStack>
        </Box>

        <Box borderWidth="1px" borderRadius="lg" p={5}>
          <VStack spacing={4} align="stretch">
            <Flex justify="space-between" align="center" gap={3}>
              <Text fontWeight="semibold">Shiprocket Cargo</Text>
              <Badge
                colorScheme={
                  data?.shiprocket?.hasAccessToken && data?.shiprocket?.hasRefreshToken
                    ? 'green'
                    : 'orange'
                }
              >
                {data?.shiprocket?.hasAccessToken && data?.shiprocket?.hasRefreshToken
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
                placeholder="https://api-cargo.shiprocket.in"
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Access Token</FormLabel>
              <Input
                type="password"
                value={shiprocketForm.accessToken}
                onChange={(e) =>
                  setShiprocketForm((prev) => ({ ...prev, accessToken: e.target.value }))
                }
                placeholder={
                  data?.shiprocket?.accessTokenMasked || 'Leave blank to keep saved access token'
                }
              />
              {!!data?.shiprocket?.accessTokenMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current access token: {data.shiprocket.accessTokenMasked}
                </Text>
              )}
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Refresh Token</FormLabel>
              <Input
                type="password"
                value={shiprocketForm.refreshToken}
                onChange={(e) =>
                  setShiprocketForm((prev) => ({ ...prev, refreshToken: e.target.value }))
                }
                placeholder={
                  data?.shiprocket?.refreshTokenMasked || 'Leave blank to keep saved refresh token'
                }
              />
              {!!data?.shiprocket?.refreshTokenMasked && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  Current refresh token: {data.shiprocket.refreshTokenMasked}
                </Text>
              )}
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
      </SimpleGrid>
    </Flex>
  )
}

export default CourierCredentials
