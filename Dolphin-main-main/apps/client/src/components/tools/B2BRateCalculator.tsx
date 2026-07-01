import { Alert, Grid } from '@mui/material'
import { useFormContext } from 'react-hook-form'
import { FiInfo } from 'react-icons/fi'
import CustomInput from '../UI/inputs/CustomInput'

export default function B2BRateCalculator() {
  const {
    register,
    formState: { errors },
  } = useFormContext()

  return (
    <Grid container spacing={2}>
      <Grid size={6}>
        <CustomInput
          label="Total Weight (kg)"
          type="number"
          {...register('totalWeight', {
            required: 'Total weight is required',
            min: { value: 0.1, message: 'Weight must be greater than 0' },
          })}
          error={!!errors.totalWeight}
          helperText={errors.totalWeight?.message as string}
          fullWidth
        />
      </Grid>
      <Grid size={6}>
        <CustomInput
          label="Number of Boxes"
          type="number"
          {...register('numberOfBoxes', {
            required: 'Number of boxes is required',
            min: { value: 1, message: 'At least 1 box is required' },
          })}
          error={!!errors.numberOfBoxes}
          helperText={errors.numberOfBoxes?.message as string}
          fullWidth
        />
      </Grid>
      <Grid size={12}>
        <Alert icon={<FiInfo size={18} />} severity="info" sx={{ width: '100%' }}>
          B2B rates use actual weight by default. Add dimensions below if you want volumetric
          pricing to be considered by the backend calculator.
        </Alert>
      </Grid>
      <Grid size={4}>
        <CustomInput
          label="Length (cm)"
          type="number"
          {...register('length', {
            min: { value: 1, message: 'Must be greater than 0' },
          })}
          error={!!errors.length}
          helperText={errors.length?.message as string}
          fullWidth
        />
      </Grid>
      <Grid size={4}>
        <CustomInput
          label="Breadth (cm)"
          type="number"
          {...register('breadth', {
            min: { value: 1, message: 'Must be greater than 0' },
          })}
          error={!!errors.breadth}
          helperText={errors.breadth?.message as string}
          fullWidth
        />
      </Grid>
      <Grid size={4}>
        <CustomInput
          label="Height (cm)"
          type="number"
          {...register('height', {
            min: { value: 1, message: 'Must be greater than 0' },
          })}
          error={!!errors.height}
          helperText={errors.height?.message as string}
          fullWidth
        />
      </Grid>
    </Grid>
  )
}
