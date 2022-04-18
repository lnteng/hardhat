import React, { useEffect, useState } from "react";
import { styled } from "linaria/react";
import SEO from "./SEO";
import Navigation from "./Navigation";
import Banner, { DefaultBanner } from "./ui/Banner";
import { tm, appTheme, tmSelectors, tmHCDark, tmDark } from "../themes";
import { DefaultBannerProps } from "./ui/types";
import { ISeo } from "./types";
import Sidebar from "./Sidebar";
import {
  DocumentationSidebarStructure,
  menuItemsList,
  socialsItems,
  bannerContent,
} from "../config";
import MobileSidebarMenu from "./MobileSidebarMenu";

const { media } = appTheme;

const Container = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  main {
    flex: 1 1 auto;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    background-color: ${tm(({ colors }) => colors.neutral0)};
    width: 100%;
    position: relative;
    transition: background-color ease-in-out 0.25s;
    ${tmSelectors.hcDark} {
      background-color: ${tmHCDark(({ colors }) => colors.neutral0)};
    }
    ${tmSelectors.dark} {
      background-color: ${tmDark(({ colors }) => colors.neutral0)};
    }
    ${media.mqDark} {
      ${tmSelectors.auto} {
        background-color: ${tmDark(({ colors }) => colors.neutral0)};
      }
    }
  }
  height: 100vh;
  min-width: 320px;
`;

const SidebarMask = styled.div`
  display: flex;
  flex-direction: column;
  border-right: 1px solid ${tm(({ colors }) => colors.neutral400)};
  ${tmSelectors.hcDark} {
    border-right: 1px solid ${tmHCDark(({ colors }) => colors.border)};
  }
  ${tmSelectors.dark} {
    border-right: 1px solid ${tmDark(({ colors }) => colors.border)};
  }
  ${media.mqDark} {
    ${tmSelectors.auto} {
      border-right: 1px solid ${tmDark(({ colors }) => colors.border)};
    }
  }
`;
const MobileSidebarMenuMask = styled.div`
  display: flex;
  flex-direction: column;
  position: absolute;
  width: 100%;
  left: -100%;
  top: 0;
  transition: all 0.25s ease-in-out;
  border-right: 1px solid ${tm(({ colors }) => colors.neutral400)};
  &[data-open="true"] {
    left: 0;
  }
  ${tmSelectors.hcDark} {
    border-right: ${tmHCDark(({ colors }) => colors.neutral400)};
  }
  ${tmSelectors.dark} {
    border-right: ${tmDark(({ colors }) => colors.neutral400)};
  }
  ${media.mqDark} {
    ${tmSelectors.auto} {
      border-right: ${tmDark(({ colors }) => colors.neutral400)};
    }
  }
`;

const SidebarContainer = styled.aside`
  flex-direction: column;
  width: 366px;
  position: fixed;
  left: 0;
  top: 136px;
  height: 85vh;
  display: flex;
  overflow-y: scroll;
  z-index: 1;
  ${SidebarMask} {
    display: none;
    ${media.md} {
      display: flex;
    }
  }
  ${MobileSidebarMenuMask} {
    display: flex;
    ${media.md} {
      display: none;
    }
  }
`;

const View = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 24px;
  width: 100%;
  height: 85vh;
  overflow-y: scroll;
  ${media.md} {
    padding-left: 366px;
  }
`;
const Content = styled.section`
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 774px;
  padding: 0 40px 0 34px;

  & h2:not(:first-of-type) {
    padding-top: 80px;
  }

  & h2 + p {
    margin-top: 32px;
  }

  color: ${tm(({ colors }) => colors.neutral900)};

  ${tmSelectors.hcDark} {
    color: ${tmHCDark(({ colors }) => colors.neutral900)};
  }

  ${tmSelectors.dark} {
    color: ${tmDark(({ colors }) => colors.neutral900)};
  }

  ${media.mqDark} {
    ${tmSelectors.auto} {
      color: ${tmDark(({ colors }) => colors.neutral900)};
    }
  }
`;

type Props = React.PropsWithChildren<{
  seo: ISeo;
}>;

const DocumentationLayout = ({ children, seo }: Props) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const body = document.querySelector("body");
    if (!body) return;

    if (isSidebarOpen) {
      // Disable scroll
      body.style.overflow = "hidden";
    } else {
      // Enable scroll
      body.style.overflow = "auto";
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    const listener = () => {
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener("click", listener);

    return () => document.removeEventListener("click", listener);
  }, [isSidebarOpen]);

  return (
    <Container>
      <Banner
        content={bannerContent}
        renderContent={({ content }: DefaultBannerProps) => (
          <DefaultBanner content={content} />
        )}
      />
      <Navigation
        isSidebarOpen={isSidebarOpen}
        onSidebarOpen={setIsSidebarOpen}
      />
      <SEO seo={seo} />

      <main>
        <SidebarContainer
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <SidebarMask>
            <Sidebar elementsList={DocumentationSidebarStructure} />
          </SidebarMask>
          <MobileSidebarMenuMask data-open={isSidebarOpen}>
            <MobileSidebarMenu
              menuItems={menuItemsList}
              socialsItems={socialsItems}
              sidebarElementsList={DocumentationSidebarStructure}
            />
          </MobileSidebarMenuMask>
        </SidebarContainer>
        <View>
          <Content>{children}</Content>
        </View>
      </main>
    </Container>
  );
};

export default DocumentationLayout;
