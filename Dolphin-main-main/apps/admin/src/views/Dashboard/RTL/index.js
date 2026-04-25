// Chakra imports
import {
  Flex,
  Grid,
  Image,
  SimpleGrid,
  useColorModeValue,
} from "@chakra-ui/react";
// assets
import peopleImage from "assets/img/people-image.png";
import BarChart from "components/Charts/BarChart";
import LineChart from "components/Charts/LineChart";
// Custom icons
import {
  CartIcon,
  DocumentIcon,
  GlobeIcon,
  WalletIcon,
} from "components/Icons/Icons.js";
import React from "react";
import { rtlDashboardTableData, rtlTimelineData } from "variables/general";
import ActiveUsers from "../Dashboard/components/ActiveUsers";
import BuiltByDevelopers from "../Dashboard/components/BuiltByDevelopers";
import MiniStatistics from "../Dashboard/components/MiniStatistics";
import OrdersOverview from "../Dashboard/components/OrdersOverview";
import Projects from "../Dashboard/components/Projects";
import SalesOverview from "../Dashboard/components/SalesOverview";
import WorkWithTheRockets from "../Dashboard/components/WorkWithTheRockets";

const logoChakra = '/logo/dolphin-logo-transparent.png'

export default function Dashboard() {
  // Chakra Color Mode

  const iconBoxInside = useColorModeValue("white", "white");

  return (
    <Flex flexDirection='column' pt={{ base: "120px", md: "75px" }}>
      <SimpleGrid columns={{ sm: 1, md: 2, xl: 4 }} spacing='24px'>
        <MiniStatistics
          title={"Ã˜Â¥Ã˜Â¬Ã™â€¦Ã˜Â§Ã™â€žÃ™Å  Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã™Å Ã˜Â¹Ã˜Â§Ã˜Âª"}
          amount={"$53,000"}
          percentage={55}
          icon={<WalletIcon h={"24px"} w={"24px"} color={iconBoxInside} />}
        />
        <MiniStatistics
          title={"Ã˜Â¹Ã™â€¦Ã™â€žÃ˜Â§Ã˜Â¡ Ã˜Â¬Ã˜Â¯Ã˜Â¯"}
          amount={"2,300"}
          percentage={5}
          icon={<GlobeIcon h={"24px"} w={"24px"} color={iconBoxInside} />}
        />
        <MiniStatistics
          title={"Ã™â€¦Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã™â€¦Ã™Ë† Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦"}
          amount={"+3,020"}
          percentage={-14}
          icon={<DocumentIcon h={"24px"} w={"24px"} color={iconBoxInside} />}
        />
        <MiniStatistics
          title={"Ã˜Â£Ã™â€¦Ã™Ë†Ã˜Â§Ã™â€ž Ã˜Â§Ã™â€žÃ™Å Ã™Ë†Ã™â€¦"}
          amount={"$173,000"}
          percentage={8}
          icon={<CartIcon h={"24px"} w={"24px"} color={iconBoxInside} />}
        />
      </SimpleGrid>
      <Grid
        templateColumns={{ md: "1fr", lg: "1.8fr 1.2fr" }}
        templateRows={{ md: "1fr auto", lg: "1fr" }}
        my='26px'
        gap='24px'>
        <BuiltByDevelopers
          title={"Ã˜Â¨Ã™â€ Ã˜Â§Ã™â€¡Ã˜Â§ Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â·Ã™Ë†Ã˜Â±Ã™Ë†Ã™â€ "}
          name={"Ã™â€žÃ™Ë†Ã˜Â­Ã˜Â© Ã™â€¦Ã˜Â¹Ã™â€žÃ™Ë†Ã™â€¦Ã˜Â§Ã˜Âª Shipzilla"}
          description={
            "Ã™â€¦Ã™â€  Ã˜Â§Ã™â€žÃ˜Â£Ã™â€žÃ™Ë†Ã˜Â§Ã™â€  Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â¨Ã˜Â·Ã˜Â§Ã™â€šÃ˜Â§Ã˜Âª Ã™Ë†Ã˜Â§Ã™â€žÃ˜Â·Ã˜Â¨Ã˜Â§Ã˜Â¹Ã˜Â© Ã˜Â¥Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€ Ã˜Â§Ã˜ÂµÃ˜Â± Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¹Ã™â€šÃ˜Â¯Ã˜Â© Ã˜Å’ Ã˜Â³Ã˜ÂªÃ˜Â¬Ã˜Â¯ Ã˜Â§Ã™â€žÃ™Ë†Ã˜Â«Ã˜Â§Ã˜Â¦Ã™â€š Ã˜Â§Ã™â€žÃ™Æ’Ã˜Â§Ã™â€¦Ã™â€žÃ˜Â©."
          }
          image={
            <Image
              src={logoChakra}
              alt='chakra image'
              minWidth={{ md: "300px", lg: "auto" }}
            />
          }
        />
        <WorkWithTheRockets
          backgroundImage={peopleImage}
          title={"Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™â€ž Ã™â€¦Ã˜Â¹ Ã˜Â§Ã™â€žÃ˜ÂµÃ™Ë†Ã˜Â§Ã˜Â±Ã™Å Ã˜Â®"}
          description={
            "Ã˜ÂªÃ™Æ’Ã™Ë†Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ˜Â«Ã˜Â±Ã™Ë†Ã˜Â© Ã™â€¡Ã™Ë† Ã™â€žÃ˜Â¹Ã˜Â¨Ã˜Â© Ã˜Â«Ã™Ë†Ã˜Â±Ã™Å Ã˜Â© Ã˜Â­Ã˜Â¯Ã™Å Ã˜Â«Ã˜Â© Ã˜Â°Ã˜Â§Ã˜Âª Ã™â€¦Ã˜Â­Ã˜ÂµÃ™â€žÃ˜Â© Ã˜Â¥Ã™Å Ã˜Â¬Ã˜Â§Ã˜Â¨Ã™Å Ã˜Â©. Ã˜Â§Ã™â€žÃ˜Â£Ã™â€¦Ã˜Â± Ã™Æ’Ã™â€žÃ™â€¡ Ã™Å Ã˜ÂªÃ˜Â¹Ã™â€žÃ™â€š Ã˜Â¨Ã™â€¦Ã™â€  Ã™Å Ã˜ÂºÃ˜ÂªÃ™â€ Ã™â€¦ Ã˜Â§Ã™â€žÃ™ÂÃ˜Â±Ã˜ÂµÃ˜Â© Ã˜Â£Ã™Ë†Ã™â€žÃ˜Â§Ã™â€¹."
          }
        />
      </Grid>
      <Grid
        templateColumns={{ sm: "1fr", lg: "1.3fr 1.7fr" }}
        templateRows={{ sm: "repeat(2, 1fr)", lg: "1fr" }}
        gap='24px'
        mb={{ lg: "26px" }}>
        <ActiveUsers
          title={"Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã™â€¦Ã™Å Ã™â€  Ã˜Â§Ã™â€žÃ™â€ Ã˜Â´Ã˜Â·Ã™Å Ã™â€ "}
          percentage={23}
          chart={<BarChart />}
        />
        <SalesOverview
          title={"Ã™â€ Ã˜Â¸Ã˜Â±Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€¦Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â¨Ã™Å Ã˜Â¹Ã˜Â§Ã˜Âª"}
          percentage={5}
          chart={<LineChart />}
        />
      </Grid>
      <Grid
        templateColumns={{ sm: "1fr", md: "1fr 1fr", lg: "2fr 1fr" }}
        templateRows={{ sm: "1fr auto", md: "1fr", lg: "1fr" }}
        gap='24px'>
        <Projects
          title={"Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â´Ã˜Â§Ã˜Â±Ã™Å Ã˜Â¹"}
          amount={30}
          captions={["Companies", "Members", "Budget", "Completion"]}
          data={rtlDashboardTableData}
        />
        <OrdersOverview
          title={"Ã™â€ Ã˜Â¸Ã˜Â±Ã˜Â© Ã˜Â¹Ã˜Â§Ã™â€¦Ã˜Â© Ã˜Â¹Ã™â€žÃ™â€° Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨Ã˜Â§Ã˜Âª"}
          amount={30}
          data={rtlTimelineData}
        />
      </Grid>
    </Flex>
  );
}

