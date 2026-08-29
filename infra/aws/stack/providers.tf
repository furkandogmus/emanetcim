terraform {
  required_version = ">= 1.9"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    # Cloudflare'in yayinladigi edge aralik listesini plan aninda okumak icin.
    # Listeyi elle gomsek sessizce bayatlar: Cloudflare yeni bir aralik
    # eklediginde o edge'lerden gelen ziyaretciler engellenir ve bunu kimse
    # fark etmez. Dinamik okumada ise fetch bozulursa plan SESLI patlar.
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
  }
}

provider "aws" {
  region  = var.region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project   = "bagajpark-aws-test"
      ManagedBy = "terraform"
      Stack     = "stack"
    }
  }
}
