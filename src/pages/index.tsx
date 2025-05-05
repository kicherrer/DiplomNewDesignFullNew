import React from 'react';
import styled, { useTheme } from 'styled-components';
import Layout from '../components/Layout/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPlay, FiTrendingUp, FiHeart, FiUsers } from 'react-icons/fi';

const HeroSection = styled.section`
  position: relative;
  text-align: center;
  padding: ${({ theme }) => theme.spacing['3xl']} ${({ theme }) => theme.spacing.xl};
  background: linear-gradient(135deg, 
    ${({ theme }) => `${theme.colors.primary}dd`}, 
    ${({ theme }) => `${theme.colors.secondary}dd`}
  );
  color: white;
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  margin: ${({ theme }) => theme.spacing.xl};
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      circle,
      ${({ theme }) => `${theme.colors.accent}22`} 0%,
      transparent 60%
    );
    animation: rotate 20s linear infinite;
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const HeroTitle = styled(motion.h1)`
  font-size: ${({ theme }) => theme.typography.fontSize['4xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
`;

const HeroSubtitle = styled(motion.p)`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  max-width: 600px;
  margin: 0 auto;
`;

const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.spacing.xl};
  padding: ${({ theme }) => theme.spacing['2xl']} ${({ theme }) => theme.spacing.xl};
  max-width: ${({ theme }) => theme.breakpoints.desktop};
  margin: 0 auto;
`;

const FeatureCard = styled(motion.div)`
  background: linear-gradient(
    135deg,
    ${({ theme }) => `${theme.colors.surface}dd`},
    ${({ theme }) => `${theme.colors.background}dd`}
  );
  padding: ${({ theme }) => theme.spacing.xl};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  text-align: center;
  backdrop-filter: blur(8px);
  border: 1px solid ${({ theme }) => `${theme.colors.border}66`};
  transition: all ${({ theme }) => theme.transitions.normal};

  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 12px 40px ${({ theme }) => `${theme.colors.primary}22`};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const FeatureTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.colors.primary};
`;

const FeatureDescription = styled.p`
  color: ${({ theme }) => theme.colors.gray[600]};
`;

const HomePage: React.FC = () => {
  const theme = useTheme();
  const features = [
    {
      icon: FiPlay,
      title: 'Умные рекомендации',
      description: 'Персонализированные предложения на основе ваших предпочтений и истории просмотров'
    },
    {
      icon: FiTrendingUp,
      title: 'Обширная библиотека',
      description: 'Тысячи фильмов, сериалов и документальных фильмов в одном месте'
    },
    {
      icon: FiUsers,
      title: 'Социальные функции',
      description: 'Обсуждайте контент с другими пользователями и делитесь рекомендациями'
    },
    {
      icon: FiHeart,
      title: 'Автоматические обновления',
      description: 'Регулярное пополнение библиотеки новым контентом через YouTube и TMDb'
    }
  ];

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <motion.div key="home-page-content">
          <HeroSection
            as={motion.section}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <HeroTitle
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              Добро пожаловать в MediaApp
            </HeroTitle>
            <HeroSubtitle
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              Ваш персональный помощник в мире медиа-контента
            </HeroSubtitle>
          </HeroSection>

          <FeaturesGrid
            as={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            {features.map((feature, index) => (
              <FeatureCard
                key={`feature-${index}`}
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ 
                  duration: 0.5, 
                  delay: 0.8 + index * 0.1,
                  type: "spring",
                  stiffness: 100 
                }}
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ 
                    delay: 1 + index * 0.1,
                    type: "spring",
                    stiffness: 200
                  }}
                >
                  <feature.icon size={40} color={theme.colors.primary} />
                </motion.div>
                <FeatureTitle>{feature.title}</FeatureTitle>
                <FeatureDescription>{feature.description}</FeatureDescription>
              </FeatureCard>
            ))}
          </FeaturesGrid>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
};

export default HomePage;