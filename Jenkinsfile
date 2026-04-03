pipeline {
  agent any

  environment {
    // Replace with your GHCR (or ECR) coordinates.
    IMAGE_PREFIX = 'ghcr.io/YOUR_ORG/sweet-spicy'
  }

  stages {
    stage('Build and push') {
      steps {
        sh '''
          echo "Replace this stage with:"
          echo "  - docker login to GHCR"
          echo "  - docker build -f apps/api/Dockerfile -t ${IMAGE_PREFIX}-api:${GIT_COMMIT} ."
          echo "  - docker build -f apps/web/Dockerfile -t ${IMAGE_PREFIX}-web:${GIT_COMMIT} . \\"
          echo "      --build-arg NEXT_PUBLIC_API_URL=https://YOUR_DOMAIN/api \\"
          echo "      --build-arg NEXT_PUBLIC_SOCKET_URL=https://YOUR_DOMAIN"
          echo "  - docker push (both images)"
        '''
      }
    }

    stage('Deploy over SSH') {
      steps {
        sh '''
          echo "Replace this stage with ssh to your deploy user, then:"
          echo "  export WEB_IMAGE=${IMAGE_PREFIX}-web:${GIT_COMMIT}"
          echo "  export API_IMAGE=${IMAGE_PREFIX}-api:${GIT_COMMIT}"
          echo "  /opt/sweet-spicy/deploy-vm.sh"
        '''
      }
    }
  }
}
